import { Hono, type Context } from "hono";
import { sampleGalaxy } from "../fixtures/sample-galaxy";
import { loadGalaxy, saveGalaxy } from "../db/store";
import { runPipeline, sanitizeChapterId } from "../pipeline/runner";
import { createHash } from "node:crypto";
import { extractFiles, UnsupportedFormatError } from "../pipeline/parsing/extract";
import type { SourceKind, SourcePart } from "@scholarsystem/shared";

// Mirrors the client's total-size ceiling in `client/src/lib/fileTypes.ts`.
// This is a CUMULATIVE cap across every file in a multi-upload request so
// users can't sneak past it by splitting into N near-limit files.
const MAX_TOTAL_BYTES = 100 * 1024 * 1024; // 100 MB

// Galaxy routes.
//
// GET  /:id        — fetch a stored galaxy; falls back to the fixture if
//                    the id is the fixture id or nothing is stored yet,
//                    so the frontend branch keeps working pre-pipeline.
// POST /create     — runs the FAST PATH of the pipeline (ingest → structure
//                    → layout) synchronously, persists, and responds. Stage 2
//                    (detail) is kicked off as fire-and-forget AFTER the
//                    response is sent; it re-persists the galaxy when done.
//                    See `pipeline/runner.ts` for the execution model.
//                    Frontend is not notified when background detail lands —
//                    nothing currently rendered consumes it. Upgrade to
//                    polling or SSE when a UI surface needs detail state.
export const galaxyRoutes = new Hono();

galaxyRoutes.get("/:id", (c) => {
  const id = c.req.param("id");

  // Dev convenience: the fixture id always returns the fixture, even after
  // the db has real galaxies in it. Lets the frontend branch hardcode one
  // id to develop against without touching the pipeline.
  if (id === sampleGalaxy.meta.id) {
    return c.json(sampleGalaxy);
  }

  const galaxy = loadGalaxy(id);
  if (!galaxy) {
    return c.json({ error: "galaxy not found", id }, 404);
  }
  return c.json(galaxy);
});

interface CreateJsonBody {
  text?: string;
  title?: string;
  filename?: string | null;
}

interface ResolvedInput {
  kind: SourceKind;
  filename: string | null;
  text: string;
  title?: string;
  parts?: SourcePart[];
  /** PDF page images for vision-based extraction in Claude Code. */
  pageImages?: { page: number; png: Buffer }[];
}

function hashUtf8(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

/**
 * Resolve the incoming request into plain text + kind, regardless of
 * whether it arrived as JSON (paste path) or multipart (multi-file +
 * optional pasted text). Throws a plain Error with a message suitable
 * for a 4xx response; the route handler turns that into a JSON error.
 *
 * Multi-file strategy (Option A from the design discussion): extract
 * each file in parallel, concatenate into one blob with `# <filename>`
 * boundary markers (which Stage 1 already treats as strong topic cues),
 * append the pasted text as its own final section, and record per-part
 * provenance on `Source.parts`. Downstream stages see a single text
 * blob exactly like before — no pipeline refactor needed.
 */
async function resolveCreateInput(c: Context): Promise<ResolvedInput> {
  const contentType = c.req.header("content-type") ?? "";

  // ─── Multipart (multi-file + optional paste) path ────────────
  if (contentType.includes("multipart/form-data")) {
    // `all: true` collapses repeated form fields into arrays so we can
    // accept multiple `file` entries under the same field name.
    const form = await c.req.parseBody({ all: true });
    const rawFiles = form["file"];
    const fileArr: File[] = Array.isArray(rawFiles)
      ? (rawFiles.filter((f): f is File => typeof f !== "string"))
      : rawFiles && typeof rawFiles !== "string"
        ? [rawFiles as File]
        : [];

    const titleField = typeof form["title"] === "string" ? (form["title"] as string) : undefined;
    const textFieldRaw = typeof form["text"] === "string" ? (form["text"] as string) : undefined;
    const textField = textFieldRaw?.trim();

    if (fileArr.length === 0 && !textField) {
      throw new Error("at least one file or a non-empty text field is required");
    }

    // Cumulative size cap BEFORE reading any file into memory.
    const totalFileBytes = fileArr.reduce((sum, f) => sum + f.size, 0);
    const textBytes = textField ? Buffer.byteLength(textField, "utf8") : 0;
    if (totalFileBytes + textBytes > MAX_TOTAL_BYTES) {
      throw new Error(`combined upload exceeds ${MAX_TOTAL_BYTES} byte limit`);
    }

    // Read + extract all files in parallel. extractFiles rejects on any
    // single failure — better to surface "pptx failed" than to silently
    // drop a file the user expected to be in their galaxy.
    const fileInputs = await Promise.all(
      fileArr.map(async (f) => ({ buf: Buffer.from(await f.arrayBuffer()), name: f.name })),
    );
    const extracted = fileInputs.length > 0 ? await extractFiles(fileInputs) : [];

    // Build per-part provenance + concatenate with boundary headers.
    const parts: SourcePart[] = [];
    const sections: string[] = [];
    const discoveredTitles: string[] = [];

    // Collect page images from PDF extractions for vision processing.
    let pageImages: ResolvedInput["pageImages"];

    extracted.forEach((ex, i) => {
      const name = fileInputs[i].name;
      const body = ex.text.trim();
      if (!body && !ex.pageImages?.length) {
        throw new Error(`extraction produced no text from ${name}`);
      }
      if (ex.title) discoveredTitles.push(ex.title);
      if (ex.pageImages?.length) {
        pageImages = (pageImages ?? []).concat(ex.pageImages);
      }
      parts.push({
        kind: ex.kind,
        filename: name,
        byteSize: Buffer.byteLength(body, "utf8"),
        charCount: body.length,
        contentHash: hashUtf8(body),
      });
      sections.push(`# ${name}\n\n${body}`);
    });

    if (textField) {
      parts.push({
        kind: "paste",
        filename: null,
        byteSize: Buffer.byteLength(textField, "utf8"),
        charCount: textField.length,
        contentHash: hashUtf8(textField),
      });
      sections.push(`# (pasted text)\n\n${textField}`);
    }

    const combined = sections.join("\n\n");
    if (!combined.trim()) {
      throw new Error("no extractable content found in upload");
    }

    // Single-part uploads keep their specific kind / filename so the
    // common case looks identical to pre-multi-file behaviour. Only
    // genuine multi-part ingests get tagged `mixed`.
    const isMulti = parts.length > 1;
    const single = parts[0];
    return {
      kind: isMulti ? "mixed" : single.kind,
      filename: isMulti ? null : single.filename,
      text: combined,
      title: titleField || discoveredTitles[0],
      parts: isMulti ? parts : undefined,
      pageImages,
    };
  }

  // ─── JSON (paste) path ────────────────────────────────────────
  let body: CreateJsonBody;
  try {
    body = (await c.req.json()) as CreateJsonBody;
  } catch {
    throw new Error("invalid JSON body");
  }
  const text = (body.text ?? "").trim();
  if (!text) throw new Error("text is required");
  return {
    kind: "paste",
    filename: body.filename ?? null,
    text,
    title: body.title,
  };
}

galaxyRoutes.post("/create", async (c) => {
  let resolved: ResolvedInput;
  try {
    resolved = await resolveCreateInput(c);
  } catch (err) {
    if (err instanceof UnsupportedFormatError) {
      return c.json({ error: "unsupported format", message: err.message }, 415);
    }
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: "invalid request", message }, 400);
  }

  try {
    const chapterId = sanitizeChapterId(resolved.title);

    const galaxy = await runPipeline(
      {
        chapterId,
        kind: resolved.kind,
        filename: resolved.filename,
        text: resolved.text,
        title: resolved.title,
        parts: resolved.parts,
        pageImages: resolved.pageImages,
      },
      {
        // Re-persist after each background stage completes so detail,
        // coverage, and narrative results survive even if the server
        // restarts before all stages finish.
        onStageComplete: (g, stage) => {
          try {
            saveGalaxy(g);
            console.log(`[galaxy/create] persisted after background stage: ${stage}`);
          } catch (err) {
            console.error(`[galaxy/create] failed to persist after ${stage}:`, err);
          }
        },
      },
    );
    saveGalaxy(galaxy);

    return c.json(galaxy, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[galaxy/create] pipeline failed:", message);
    return c.json({ error: "pipeline failed", message }, 500);
  }
});
