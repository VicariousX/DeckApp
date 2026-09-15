/**
 * Courteous pacing for cards.scryfall.io loads + short session cache of
 * decoded image URLs so print-grid revisits do not re-queue every thumb.
 */

const MAX_CONCURRENT = 14;
const MIN_GAP_MS = 16;
/** Keep warmed URL entries for 30 minutes. */
const CACHE_TTL_MS = 30 * 60 * 1000;

let active = 0;
let lastStart = 0;
const queue: Array<() => void> = [];

/** url → expiresAt */
const warmed = new Map<string, number>();

function pruneWarmed() {
  const now = Date.now();
  for (const [url, exp] of warmed) {
    if (exp <= now) warmed.delete(url);
  }
}

export function isImageWarmed(src: string | undefined | null): boolean {
  if (!src) return false;
  const exp = warmed.get(src);
  if (!exp) return false;
  if (exp <= Date.now()) {
    warmed.delete(src);
    return false;
  }
  return true;
}

export function markImageWarmed(src: string): void {
  warmed.set(src, Date.now() + CACHE_TTL_MS);
}

/** Preload a list of URLs through the same polite queue (print grid). */
export function preloadScryfallImages(urls: string[]): void {
  pruneWarmed();
  for (const url of urls) {
    if (!url || isImageWarmed(url)) continue;
    enqueueScryfallImageLoad(() => {
      const img = new Image();
      img.decoding = "async";
      img.onload = () => {
        markImageWarmed(url);
        releaseScryfallImageSlot();
      };
      img.onerror = () => {
        releaseScryfallImageSlot();
      };
      img.src = url;
    });
  }
}

function pump() {
  if (active >= MAX_CONCURRENT) return;
  if (queue.length === 0) return;
  const now = Date.now();
  const wait = Math.max(0, lastStart + MIN_GAP_MS - now);
  if (wait > 0) {
    setTimeout(pump, wait);
    return;
  }
  const job = queue.shift();
  if (!job) return;
  active++;
  lastStart = Date.now();
  job();
}

export function enqueueScryfallImageLoad(start: () => void): void {
  queue.push(start);
  pump();
}

export function releaseScryfallImageSlot(): void {
  active = Math.max(0, active - 1);
  pump();
}

export function isScryfallCdnUrl(src: string | undefined | null): boolean {
  if (!src) return false;
  try {
    const u = new URL(src, window.location.href);
    return (
      u.hostname.endsWith("scryfall.io") ||
      u.hostname.endsWith("scryfall.com")
    );
  } catch {
    return /scryfall\.(io|com)/i.test(src);
  }
}
