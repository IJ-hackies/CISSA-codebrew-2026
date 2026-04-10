/**
 * A single Claude Code process wrapper.
 *
 * Each process is invoked with `claude -p <prompt>` in the context of
 * a specific workspace directory (cwd). The process reads files from
 * the previous stage folder and writes to the current stage folder.
 *
 * Unlike the old spawner (fire-and-forget), these processes:
 *   - Run with a specific cwd so Claude Code sees the workspace files
 *   - Stream stdout for SSE progress (line-by-line)
 *   - Are managed by the pool for concurrency control
 */
export interface RunRequest {
  /** The prompt to send to Claude Code. */
  prompt: string;
  /** Working directory — the galaxy workspace root. */
  cwd: string;
  /** Optional model override (e.g. "sonnet" for most stages). */
  model?: string;
  /** Abort signal for cancellation. */
  signal?: AbortSignal;
}

export interface RunResult {
  ok: boolean;
  output: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
}

import { config } from "../config";

function buildArgs(req: RunRequest): string[] {
  // -p = print mode (non-interactive, exits after responding)
  // --dangerously-skip-permissions = allow tool use (Write/Edit/Bash)
  //   without interactive approval. Required because Claude Code in
  //   print mode with tool access is how the pipeline writes files
  //   into the workspace stage folders.
  const model = req.model ?? config.defaultModel;
  const args = [
    "-p", req.prompt,
    "--dangerously-skip-permissions",
    "--model", model,
  ];
  return args;
}

/**
 * Run a Claude Code session against a workspace directory.
 */
export async function runClaudeCode(req: RunRequest): Promise<RunResult> {
  const started = Date.now();

  const proc = Bun.spawn(["claude", ...buildArgs(req)], {
    cwd: req.cwd,
    stdout: "pipe",
    stderr: "pipe",
  });

  if (req.signal) {
    req.signal.addEventListener("abort", () => proc.kill(), { once: true });
  }

  const stdout = await new Response(proc.stdout as ReadableStream).text();
  const stderr = await new Response(proc.stderr as ReadableStream).text();
  const exitCode = await proc.exited;

  return {
    ok: exitCode === 0,
    output: stdout.trim(),
    stderr: stderr.trim(),
    exitCode,
    durationMs: Date.now() - started,
  };
}

/**
 * Run Claude Code and stream stdout line-by-line to a callback.
 *
 * Used by the SSE endpoint so the API server (and ultimately the
 * frontend) can see progress in real time rather than waiting for
 * the full response.
 */
export async function runClaudeCodeStreaming(
  req: RunRequest,
  onLine: (line: string) => void,
): Promise<RunResult> {
  const started = Date.now();

  const proc = Bun.spawn(["claude", ...buildArgs(req)], {
    cwd: req.cwd,
    stdout: "pipe",
    stderr: "pipe",
  });

  if (req.signal) {
    req.signal.addEventListener("abort", () => proc.kill(), { once: true });
  }

  // Stream stdout line-by-line
  const stream = proc.stdout as ReadableStream<Uint8Array>;
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const chunks: string[] = [];

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const text = decoder.decode(value, { stream: true });
      chunks.push(text);
      buffer += text;

      // Flush complete lines
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (line.trim()) onLine(line);
      }
    }
  } finally {
    reader.releaseLock();
  }

  // Flush remaining buffer
  if (buffer.trim()) onLine(buffer);

  const stderr = await new Response(proc.stderr as ReadableStream).text();
  const exitCode = await proc.exited;

  return {
    ok: exitCode === 0,
    output: chunks.join(""),
    stderr: stderr.trim(),
    exitCode,
    durationMs: Date.now() - started,
  };
}
