// Proxy configuration — all values overridable via env vars.

export const config = {
  /** Port the proxy listens on. */
  port: Number(process.env.PROXY_PORT ?? 4100),

  /** Root directory for per-galaxy workspaces. */
  workspacesDir: process.env.WORKSPACES_DIR ?? "./workspaces",

  /** Max concurrent Claude Code processes across all sessions. */
  maxConcurrency: Number(process.env.MAX_CONCURRENCY ?? 4),

  /** Idle workspace TTL in milliseconds (default 30 min). */
  idleTtlMs: Number(process.env.IDLE_TTL_MS ?? 30 * 60 * 1000),

  /** How often to sweep for idle workspaces (default 5 min). */
  sweepIntervalMs: Number(process.env.SWEEP_INTERVAL_MS ?? 5 * 60 * 1000),
} as const;
