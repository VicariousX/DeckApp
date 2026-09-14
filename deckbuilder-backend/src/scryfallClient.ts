/**
 * Scryfall upstream client with hard rate limiting, 429 backoff, and short TTL cache.
 *
 * Official limits (https://scryfall.com/docs/api/rate-limits):
 * - /cards/search, /cards/named, /cards/random, /cards/collection → 2/sec (500ms)
 * - /cards/manifest → 10/min
 * - everything else → 10/sec (100ms)
 *
 * We serialize all upstream traffic through one queue and space calls accordingly.
 * Cache reduces repeat hits (card-by-id, autocomplete, printings).
 */

const SCRYFALL_HEADERS: Record<string, string> = {
  "User-Agent": "DeckApp/1.0 (https://github.com/VicariousX/DeckApp; deck builder)",
  Accept: "application/json",
};

type QueueJob = {
  run: () => Promise<void>;
};

type CacheEntry = {
  status: number;
  data: unknown;
  expires: number;
};

const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<{ status: number; data: unknown }>>();

let chain: Promise<void> = Promise.resolve();
let lastRequestAt = 0;

/** Min spacing between upstream calls by path class (ms). */
function minIntervalMs(path: string): number {
  if (
    path.startsWith("/cards/search") ||
    path.startsWith("/cards/named") ||
    path.startsWith("/cards/random") ||
    path.startsWith("/cards/collection")
  ) {
    return 550; // under 2/sec hard limit
  }
  if (path.startsWith("/cards/manifest")) {
    return 6000;
  }
  return 110; // under 10/sec
}

function cacheTtlMs(path: string): number {
  if (path.startsWith("/cards/") && path.length > 40) {
    // card by UUID — stable for a session
    return 1000 * 60 * 60; // 1h
  }
  if (path.startsWith("/cards/autocomplete")) {
    return 1000 * 60 * 10; // 10m
  }
  if (path.includes("prints") || path.includes("unique=prints")) {
    return 1000 * 60 * 30; // 30m
  }
  if (path.startsWith("/cards/collection")) {
    return 1000 * 60 * 5;
  }
  if (path.startsWith("/cards/named") || path.startsWith("/cards/search")) {
    return 1000 * 60 * 5;
  }
  return 1000 * 60 * 2;
}

function cacheKey(method: string, pathOrUrl: string, body?: string): string {
  return `${method}:${pathOrUrl}:${body ?? ""}`;
}

function getCached(key: string): { status: number; data: unknown } | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expires) {
    cache.delete(key);
    return null;
  }
  return { status: hit.status, data: hit.data };
}

function setCache(
  key: string,
  path: string,
  status: number,
  data: unknown
): void {
  // Don't cache rate-limit or server errors
  if (status === 429 || status >= 500) return;
  cache.set(key, {
    status,
    data,
    expires: Date.now() + cacheTtlMs(path),
  });
}

async function waitForSlot(path: string): Promise<void> {
  const gap = minIntervalMs(path);
  const now = Date.now();
  const wait = Math.max(0, lastRequestAt + gap - now);
  if (wait > 0) {
    await new Promise((r) => setTimeout(r, wait));
  }
  lastRequestAt = Date.now();
}

function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const job = chain.then(fn, fn);
  // Keep chain alive even if job fails
  chain = job.then(
    () => undefined,
    () => undefined
  );
  return job;
}

async function upstreamFetch(
  method: "GET" | "POST",
  path: string,
  body?: string
): Promise<{ status: number; data: unknown; headers: Headers }> {
  const url = path.startsWith("http")
    ? path
    : `https://api.scryfall.com${path}`;

  await waitForSlot(path);

  const res = await fetch(url, {
    method,
    headers: {
      ...SCRYFALL_HEADERS,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body,
  });

  // Respect 429 — wait Retry-After then one automatic retry
  if (res.status === 429) {
    const retryAfter = Number(res.headers.get("retry-after") || "60");
    const ms = Math.min(120_000, Math.max(5_000, retryAfter * 1000));
    console.warn(
      `[scryfall] 429 rate limited on ${path}; backing off ${ms}ms`
    );
    await new Promise((r) => setTimeout(r, ms));
    await waitForSlot(path);
    const retry = await fetch(url, {
      method,
      headers: {
        ...SCRYFALL_HEADERS,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body,
    });
    let data: unknown;
    try {
      data = await retry.json();
    } catch {
      data = { error: "Invalid JSON from Scryfall" };
    }
    return { status: retry.status, data, headers: retry.headers };
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    data = { error: "Invalid JSON from Scryfall" };
  }
  return { status: res.status, data, headers: res.headers };
}

export async function scryfallGet(
  pathAndQuery: string
): Promise<{ status: number; data: unknown }> {
  const key = cacheKey("GET", pathAndQuery);
  const cached = getCached(key);
  if (cached) return cached;

  const existing = inflight.get(key);
  if (existing) return existing;

  const promise = enqueue(async () => {
    // re-check cache inside queue
    const again = getCached(key);
    if (again) return again;
    const { status, data } = await upstreamFetch("GET", pathAndQuery);
    setCache(key, pathAndQuery, status, data);
    return { status, data };
  }).finally(() => {
    inflight.delete(key);
  });

  inflight.set(key, promise);
  return promise;
}

export async function scryfallPost(
  path: string,
  body: unknown
): Promise<{ status: number; data: unknown }> {
  const bodyStr = JSON.stringify(body);
  const key = cacheKey("POST", path, bodyStr);
  const cached = getCached(key);
  if (cached) return cached;

  const existing = inflight.get(key);
  if (existing) return existing;

  const promise = enqueue(async () => {
    const again = getCached(key);
    if (again) return again;
    const { status, data } = await upstreamFetch("POST", path, bodyStr);
    setCache(key, path, status, data);
    return { status, data };
  }).finally(() => {
    inflight.delete(key);
  });

  inflight.set(key, promise);
  return promise;
}

export function scryfallCacheStats(): { size: number } {
  return { size: cache.size };
}
