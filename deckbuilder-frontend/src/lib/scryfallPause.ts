/**
 * Scryfall kill switch.
 * Any 429 trips the switch. While tripped, all Scryfall calls short-circuit.
 * State persists in localStorage so a reload does not immediately retry.
 */

const KEY = "deckapp.scryfall.paused";

function read(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

function write(v: boolean) {
  try {
    if (v) localStorage.setItem(KEY, "1");
    else localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

let paused = typeof window !== "undefined" ? read() : false;
const listeners = new Set<(paused: boolean) => void>();

export function isScryfallPaused(): boolean {
  return paused;
}

export function tripScryfallPause() {
  if (paused) return;
  paused = true;
  write(true);
  listeners.forEach((fn) => fn(true));
}

export function resetScryfallPause() {
  if (!paused) return;
  paused = false;
  write(false);
  listeners.forEach((fn) => fn(false));
}

export function onScryfallPauseChange(fn: (paused: boolean) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
