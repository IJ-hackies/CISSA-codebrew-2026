import { Hono } from "hono";
import { sampleGalaxy } from "../fixtures/sample-galaxy";
import { loadGalaxy, saveGalaxy } from "../db/store";
import { runPipeline } from "../pipeline/runner";

// Galaxy routes.
//
// GET  /:id        — fetch a stored galaxy; falls back to the fixture if
//                    the id is the fixture id or nothing is stored yet,
//                    so the frontend branch keeps working pre-pipeline.
// POST /create     — runs the full pipeline slice (ingest → structure →
//                    layout) over a text payload, persists the result,
//                    returns the Galaxy blob. Synchronous for v1 — streaming
//                    progress via SSE is a later upgrade once detail stages
//                    land and the latency budget demands it.
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

interface CreateBody {
  text?: string;
  title?: string;
  filename?: string | null;
}

galaxyRoutes.post("/create", async (c) => {
  let body: CreateBody;
  try {
    body = (await c.req.json()) as CreateBody;
  } catch {
    return c.json({ error: "invalid JSON body" }, 400);
  }

  const text = (body.text ?? "").trim();
  if (!text) {
    return c.json({ error: "text is required" }, 400);
  }

  try {
    const galaxy = await runPipeline({
      kind: "text",
      filename: body.filename ?? null,
      text,
      title: body.title,
    });
    saveGalaxy(galaxy);
    return c.json(galaxy, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[galaxy/create] pipeline failed:", message);
    return c.json({ error: "pipeline failed", message }, 500);
  }
});
