// Local Claude Code spawner.
//
// Shells out to the `claude` CLI in non-interactive print mode (`-p`) and
// returns the model's response as a string. This is the dev-time access path
// for the content pipeline; it will be swapped for an HTTP client against the
// proxy server pre-deployment. Keep the request/response shape stable so that
// swap is a single adapter change.

export interface SpawnerRequest {
  prompt: string;
  input?: string;
  // Future: systemPrompt, model, maxTokens, etc. Add only when needed.
}

export interface SpawnerResponse {
  ok: boolean;
  output: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
}

export async function runClaude(req: SpawnerRequest): Promise<SpawnerResponse> {
  const started = Date.now();

  // Compose the full prompt: if the caller passed structured input, append it
  // under a clear delimiter so the model can tell instructions from payload.
  const fullPrompt = req.input
    ? `${req.prompt}\n\n---INPUT---\n${req.input}`
    : req.prompt;

  const proc = Bun.spawn(["claude", "-p", fullPrompt], {
    stdout: "pipe",
    stderr: "pipe",
  });

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  return {
    ok: exitCode === 0,
    output: stdout.trim(),
    stderr: stderr.trim(),
    exitCode,
    durationMs: Date.now() - started,
  };
}
