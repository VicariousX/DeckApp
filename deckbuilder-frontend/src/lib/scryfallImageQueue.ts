/**
 * Courteous pacing for cards.scryfall.io / img.scryfall.com loads.
 * CDN is not under the API rate limit, but we still avoid stampeding it.
 */

const MAX_CONCURRENT = 6;
const MIN_GAP_MS = 40;

let active = 0;
let lastStart = 0;
const queue: Array<() => void> = [];

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

/** Schedule work when an image slot is free. */
export function enqueueScryfallImageLoad(start: () => void): void {
  queue.push(start);
  pump();
}

export function releaseScryfallImageSlot(): void {
  active = Math.max(0, active - 1);
  pump();
}

/** True for Scryfall CDN hosts (images, not api.scryfall.com). */
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
