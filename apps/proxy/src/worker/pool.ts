import { config } from "../config";
import {
  runClaudeCode,
  runClaudeCodeStreaming,
  type RunRequest,
  type RunResult,
} from "./process";

/**
 * Worker pool for Claude Code processes.
 *
 * Caps total concurrent Claude Code invocations across all sessions
 * to `config.maxConcurrency`. Excess requests queue and run FIFO.
 * The pool does NOT own session locking — that's the workspace
 * manager's single-writer lock.
 */

interface QueueEntry {
  run: () => Promise<RunResult>;
  resolve: (r: RunResult) => void;
  reject: (e: unknown) => void;
}

let active = 0;
const queue: QueueEntry[] = [];

function drain(): void {
  while (queue.length > 0 && active < config.maxConcurrency) {
    const entry = queue.shift()!;
    active++;
    entry
      .run()
      .then((r) => entry.resolve(r))
      .catch((e) => entry.reject(e))
      .finally(() => {
        active--;
        drain();
      });
  }
}

/** Submit a non-streaming Claude Code run through the pool. */
export function submit(req: RunRequest): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    queue.push({ run: () => runClaudeCode(req), resolve, reject });
    drain();
  });
}

/** Submit a streaming Claude Code run through the pool. */
export function submitStreaming(
  req: RunRequest,
  onLine: (line: string) => void,
): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    queue.push({
      run: () => runClaudeCodeStreaming(req, onLine),
      resolve,
      reject,
    });
    drain();
  });
}

/** Current pool stats — for the health endpoint. */
export function stats(): { active: number; queued: number; max: number } {
  return { active, queued: queue.length, max: config.maxConcurrency };
}
