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
  stderr?: string;
}> {
  // Claude Code sessions can run for many minutes on large inputs.
  // Bun's default fetch timeout (300s) is too short — use 30 min for
  // the SSE stream, but let the caller override via opts.signal.
  const signal =
    opts.signal ?? AbortSignal.timeout(30 * 60 * 1000);

  const res = await fetch(
    `${PROXY_BASE}/session/${opts.galaxyId}/run`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: opts.prompt, model: opts.model }),
      signal,
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

// ─── Sub-session fan-out helpers ─────────────────────────────────
//
// Sub-sessions are lightweight, isolated proxy sessions used for
// parallel fan-out stages (detail, visuals). Each sub-session gets
// its own workspace and Claude Code process, so there's no
// single-writer conflict. The pattern:
//
//   1. Define a SubSessionTask (id, files to push, prompt)
//   2. Call fanOutSubSessions() with the array of tasks
//   3. It runs them in parallel (up to concurrency limit),
//      collects output files from each, and cleans up
//   4. Returns merged files ready for the compile step

export interface SubSessionTask {
  /** Sub-session ID (e.g. `galaxyId--d--conceptId`). Must be unique. */
  sessionId: string;
  /** Files to push into the sub-session workspace before running. */
  files: Record<string, string>;
  /** The prompt for the Claude Code agent. */
  prompt: string;
  /** Optional model override (e.g. "haiku" for visuals). */
  model?: string;
  /** Label for logging (e.g. concept id). */
  label: string;
}

export interface SubSessionResult {
  label: string;
  sessionId: string;
  ok: boolean;
  files: Record<string, string>;
  durationMs: number;
  error?: string;
}

/**
 * Run multiple sub-sessions in parallel. Each gets its own proxy
 * workspace, runs a single Claude Code agent, and returns its
 * output files. Workspaces are cleaned up after collection.
 *
 * Concurrency is bounded by the proxy's worker pool (maxConcurrency),
 * but we also apply a client-side limit to avoid overwhelming the
 * proxy with queued requests.
 *
 * @param tasks - Array of sub-session definitions
 * @param concurrency - Max parallel requests from the client side (default 10)
 * @returns Results for each task (including failures)
 */
export async function fanOutSubSessions(
  tasks: SubSessionTask[],
  concurrency = 10,
): Promise<SubSessionResult[]> {
  const results: SubSessionResult[] = [];
  let idx = 0;

  async function runOne(task: SubSessionTask): Promise<SubSessionResult> {
    const started = Date.now();
    try {
      // 1. Create workspace and push scoped files.
      await pushFiles(task.sessionId, task.files);

      // 2. Run the Claude Code agent.
      const result = await runStage({
        galaxyId: task.sessionId,
        prompt: task.prompt,
        model: task.model,
      });

      if (!result.ok) {
        return {
          label: task.label,
          sessionId: task.sessionId,
          ok: false,
          files: {},
          durationMs: Date.now() - started,
          error: `exit code ${result.exitCode}`,
        };
      }

      // 3. Collect output files.
      const files = await compileFiles(task.sessionId);

      return {
        label: task.label,
        sessionId: task.sessionId,
        ok: true,
        files,
        durationMs: Date.now() - started,
      };
    } catch (err) {
      return {
        label: task.label,
        sessionId: task.sessionId,
        ok: false,
        files: {},
        durationMs: Date.now() - started,
        error: err instanceof Error ? err.message : String(err),
      };
    } finally {
      // 4. Clean up the sub-session workspace (best-effort).
      // Small delay lets Windows release file handles from the claude subprocess.
      setTimeout(() => destroySession(task.sessionId).catch(() => {}), 1000);
    }
  }

  // Semaphore-style concurrency control.
  async function worker(): Promise<void> {
    while (idx < tasks.length) {
      const taskIdx = idx++;
      const task = tasks[taskIdx];
      console.log(
        `[fan-out] starting ${task.label} (${taskIdx + 1}/${tasks.length})`,
      );
      const result = await runOne(task);
      results.push(result);
      if (result.ok) {
        console.log(
          `[fan-out] ${task.label} done (${result.durationMs}ms)`,
        );
      } else {
        console.warn(
          `[fan-out] ${task.label} failed: ${result.error}`,
        );
      }
    }
  }

  // Launch `concurrency` workers.
  const workers = Array.from(
    { length: Math.min(concurrency, tasks.length) },
    () => worker(),
  );
  await Promise.all(workers);

  return results;
}

/**
 * Merge output files from multiple sub-session results into one
 * flat record, as if all files lived in a single workspace.
 * Filters to a specific stage folder prefix.
 */
export function mergeSubSessionFiles(
  results: SubSessionResult[],
  stagePrefix: string,
): Record<string, string> {
  const merged: Record<string, string> = {};
  for (const result of results) {
    if (!result.ok) continue;
    for (const [path, content] of Object.entries(result.files)) {
      if (path.startsWith(stagePrefix)) {
        merged[path] = content;
      }
    }
  }
  return merged;
}
