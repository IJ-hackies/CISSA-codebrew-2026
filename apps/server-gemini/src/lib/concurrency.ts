// Bounded parallel fan-out. Every parallel pipeline stage routes through
// this so the Gemini per-minute quota is a single dial we can turn.

export type Limiter = <T>(fn: () => Promise<T>) => Promise<T>;

export function createLimiter(maxConcurrent: number): Limiter {
  let active = 0;
  const queue: Array<() => void> = [];

  const next = () => {
    if (active >= maxConcurrent) return;
    const run = queue.shift();
    if (run) {
      active++;
      run();
    }
  };

  return <T>(fn: () => Promise<T>): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      queue.push(() => {
        fn()
          .then(resolve, reject)
          .finally(() => {
            active--;
            next();
          });
      });
      next();
    });
}

export async function mapLimited<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const limiter = createLimiter(limit);
  return Promise.all(items.map((item, i) => limiter(() => fn(item, i))));
}

// Like mapLimited, but catches per-item errors, logs them, and returns
// only the successful results. Use when one failed item shouldn't kill
// a whole stage — e.g. ingesting 1000 files where one happens to make
// Gemini choke. Returns the successes plus a count of failures.
export async function mapLimitedTolerant<T, R>(
  items: T[],
  limit: number,
  label: string,
  fn: (item: T, index: number) => Promise<R>,
): Promise<{ results: R[]; failed: number }> {
  const limiter = createLimiter(limit);
  const results: R[] = [];
  let failed = 0;
  await Promise.all(
    items.map((item, i) =>
      limiter(async () => {
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
