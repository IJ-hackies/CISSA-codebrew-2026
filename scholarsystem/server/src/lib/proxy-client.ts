import type { Galaxy } from "@scholarsystem/shared";

/**
 * HTTP client for the workspace proxy.
 *
 * Replaces the old `spawner.ts` — instead of shelling out to `claude`
 * locally, the API server talks to the proxy over HTTP, which manages
 * workspace directories and Claude Code processes on a VPS.
 */

const PROXY_BASE = process.env.PROXY_URL ?? "http://localhost:4100";

// ─── POST /session/:id/files ──────────────────────────────────────

export async function pushFiles(
  galaxyId: string,
  files: Record<string, string>,
  blob?: Galaxy,
  binaryFiles?: Record<string, string>,
): Promise<void> {
  const res = await fetch(`${PROXY_BASE}/session/${galaxyId}/files`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ files, blob, binaryFiles }),
  });
  if (!res.ok) {
    throw new Error(
      `proxy pushFiles failed: ${res.status} ${await res.text()}`,
    );
  }
}

// ─── POST /session/:id/run (SSE) ─────────────────────────────────

export interface RunStageOptions {
  galaxyId: string;
  prompt: string;
  model?: string;
  onProgress?: (line: string) => void;
  onDone?: (result: { ok: boolean; exitCode: number; durationMs: number }) => void;
  onError?: (message: string) => void;
  signal?: AbortSignal;
}

/**
 * Run a Claude Code session against the workspace and consume the
 * SSE stream. Returns when the stream closes.
 */
export async function runStage(opts: RunStageOptions): Promise<{
  ok: boolean;
  exitCode: number;
  durationMs: number;
}> {
  const res = await fetch(
    `${PROXY_BASE}/session/${opts.galaxyId}/run`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: opts.prompt, model: opts.model }),
      signal: opts.signal,
    },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`proxy runStage failed: ${res.status} ${text}`);
  }

  // Parse SSE stream
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalResult = { ok: false, exitCode: 1, durationMs: 0 };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const messages = buffer.split("\n\n");
    buffer = messages.pop() ?? "";

    for (const msg of messages) {
      const eventMatch = msg.match(/^event: (.+)$/m);
      const dataMatch = msg.match(/^data: (.+)$/m);
      if (!eventMatch || !dataMatch) continue;

      const event = eventMatch[1];
      const data = JSON.parse(dataMatch[1]);

      switch (event) {
        case "progress":
          opts.onProgress?.(data.line);
          break;
        case "done":
          finalResult = data;
          opts.onDone?.(data);
          break;
        case "error":
          opts.onError?.(data.message);
          break;
      }
    }
  }

  return finalResult;
}

// ─── GET /session/:id/compile ─────────────────────────────────────

export async function compileFiles(
  galaxyId: string,
): Promise<Record<string, string>> {
  const res = await fetch(
    `${PROXY_BASE}/session/${galaxyId}/compile`,
  );
  if (!res.ok) {
    throw new Error(
      `proxy compile failed: ${res.status} ${await res.text()}`,
    );
  }
  const body = await res.json();
  return (body as { files: Record<string, string> }).files;
}

// ─── DELETE /session/:id ──────────────────────────────────────────

export async function destroySession(galaxyId: string): Promise<void> {
  const res = await fetch(`${PROXY_BASE}/session/${galaxyId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    throw new Error(
      `proxy destroy failed: ${res.status} ${await res.text()}`,
    );
  }
}
