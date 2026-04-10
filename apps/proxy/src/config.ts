// Proxy configuration — all values overridable via env vars.
//
// During development, set CLAUDE_MODEL=haiku to avoid burning usage
// on expensive models. The server can still override per-request via
// the `model` field in POST /session/:id/run, but if omitted the
// default model from this config is used.

export const config = {
  /** Port the proxy listens on. */
  port: Number(process.env.PROXY_PORT ?? 8890),

  /** Root directory for per-galaxy workspaces. */
  workspacesDir: process.env.WORKSPACES_DIR ?? "./workspaces",

  /** Max concurrent Claude Code processes across all sessions.
   *  Raised from 4 to support parallel sub-session fan-out in
   *  Stage 2 (detail) and Stage 5 (visuals). Each sub-session is
   *  lightweight (1 file output), so higher concurrency is safe. */
  maxConcurrency: Number(process.env.MAX_CONCURRENCY ?? 10),

  /** Idle workspace TTL in milliseconds (default 30 min). */
  idleTtlMs: Number(process.env.IDLE_TTL_MS ?? 30 * 60 * 1000),

  /** How often to sweep for idle workspaces (default 5 min). */
  sweepIntervalMs: Number(process.env.SWEEP_INTERVAL_MS ?? 5 * 60 * 1000),

  /**
   * Default Claude model for pipeline stages.
   * Set via CLAUDE_MODEL env var. If a request specifies a model,
   * the request's model takes precedence.
   *
   * Common values:
   *   "haiku"  — cheapest, good for dev/testing
   *   "sonnet" — default for production pipeline stages
   *   "opus"   — only for Stage 6 heavy concepts
   */
  defaultModel: process.env.CLAUDE_MODEL ?? "sonnet",
} as const;
