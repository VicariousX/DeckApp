/**
 * Client-side request queue to avoid flooding the backend / Scryfall.
 * Serializes calls with a minimum gap. 429s trigger a backoff.
 */

type Job<T> = {
  run: () => Promise<T>;
  resolve: (v: T) => void;
  reject: (e: unknown) => void;
};

const queue: Job<unknown>[] = [];
let running = false;
let lastStart = 0;
const MIN_GAP = 120; // ms between starts
let backoffUntil = 0;

function now() {
  return Date.now();
}

async function pump() {
  if (running) return;
  running = true;
  while (queue.length) {
    const wait = Math.max(0, backoffUntil - now(), MIN_GAP - (now() - lastStart));
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    const job = queue.shift();
    if (!job) break;
    lastStart = now();
    try {
      const result = await job.run();
      job.resolve(result);
    } catch (e) {
      if (e instanceof Error && /429/.test(e.message)) {
        backoffUntil = now() + 2000;
      }
      job.reject(e);
    }
  }
  running = false;
}

export function enqueue<T>(run: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    queue.push({ run, resolve, reject } as Job<unknown>);
    void pump();
  });
}

export function noteRateLimit() {
  backoffUntil = now() + 2000;
}
