// Byte-weighted concurrency limiter. Unlike the plain count-based limiter
// in `concurrency.ts`, each task declares a weight and the limiter admits
// as many tasks as fit under both:
//
//   - `maxWeight`     — sum of in-flight weights (the "byte budget")
//   - `maxConcurrent` — raw count cap (safety net for per-minute request quota)
//
// Motivation: ingest processes wildly different file sizes in a single
// batch. A fixed count cap is either overkill for 500 tiny files or
// underkill for 6 large PDFs; a weighted budget adapts to both in one pass.
//
// Starvation guard: if nothing is active and the head of the queue is
// larger than the whole budget, we still admit it. A single oversized
// file should never deadlock the pipeline.
//
// Admission order: FIFO scan with forward skipping — we dequeue the first
// task that fits under the current headroom. That lets small tasks slip
// past a queued giant instead of waiting for the giant to land first.

export interface WeightedLimiter {
  run<T>(weight: number, fn: () => Promise<T>): Promise<T>;
  stats(): { active: number; activeWeight: number; queued: number };
}

export interface WeightedLimiterOpts {
  maxWeight: number;
  maxConcurrent: number;
}

interface Waiter {
  weight: number;
  admit: () => void;
}

export function createWeightedLimiter(opts: WeightedLimiterOpts): WeightedLimiter {
  const { maxWeight, maxConcurrent } = opts;
  let activeWeight = 0;
  let activeCount = 0;
  const queue: Waiter[] = [];

  const tryAdmit = (): void => {
    // Keep pulling admissible tasks until we hit a ceiling.
    while (activeCount < maxConcurrent && queue.length > 0) {
      // First-fit forward scan. Lets a 1KB task run past a queued 50MB
      // task instead of waiting for the 50MB one to finish.
      let chosen = -1;
      for (let i = 0; i < queue.length; i++) {
        const w = queue[i].weight;
        const fits = activeWeight + w <= maxWeight;
        const starvationOverride = activeCount === 0; // admit even oversized lone task
        if (fits || starvationOverride) {
          chosen = i;
          break;
        }
      }
      if (chosen === -1) return;
      const [task] = queue.splice(chosen, 1);
      activeWeight += task.weight;
      activeCount++;
      task.admit();
    }
  };

  return {
    run<T>(weight: number, fn: () => Promise<T>): Promise<T> {
      const w = Math.max(1, Math.floor(weight));
      return new Promise<T>((resolve, reject) => {
        queue.push({
          weight: w,
          admit: () => {
            fn()
              .then(resolve, reject)
              .finally(() => {
                activeWeight -= w;
                activeCount--;
                tryAdmit();
              });
          },
        });
        tryAdmit();
      });
    },
    stats() {
      return { active: activeCount, activeWeight, queued: queue.length };
    },
  };
}

// Tolerant fan-out over a weighted limiter — same contract as
// `mapLimitedTolerant` from `concurrency.ts` but each item declares a
// weight via `weightFn`. Catches per-item errors, logs them, and returns
// the successes plus a failure count.
export async function mapWeightedTolerant<T, R>(
  items: T[],
  limiter: WeightedLimiter,
  label: string,
  weightFn: (item: T, index: number) => number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<{ results: R[]; failed: number }> {
  const results: R[] = [];
  let failed = 0;
  await Promise.all(
    items.map((item, i) =>
      limiter.run(weightFn(item, i), async () => {
        try {
          results.push(await fn(item, i));
        } catch (err) {
          failed++;
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`[${label}:${i}] ${msg.slice(0, 300)}`);
        }
      }),
    ),
  );
  return { results, failed };
}
