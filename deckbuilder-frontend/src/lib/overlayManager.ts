/**
 * Single owner of open surfaces.
 *
 * Replaces the previous mix of overlayHistory, per-component history
 * entries, and scattered Escape / scroll-lock handling. Every modal,
 * sheet, lightbox, enlarge overlay, and scroll stage registers here.
 * The manager:
 *   - keeps an ordered stack (top is the one that owns input)
 *   - pushes one history entry per overlay so mobile back closes the top
 *   - owns the body scroll lock while any overlay wants it
 *   - routes Escape to the top overlay
 *   - answers "is this the top surface?" so gesture handlers can yield
 *
 * ImageDeckDnd and PlaytestPage still call lockBodyScroll directly
 * because they are not dismissible overlays.
 */
import { lockBodyScroll } from "./scrollLock";

export type OverlayType =
  | "modal"
  | "sheet"
  | "scroll"
  | "menu"
  | "enlarge"
  | "lightbox"
  | "other";

type Entry = {
  id: string;
  type: OverlayType;
  close: () => void;
  locksScroll: boolean;
  zIndex: number;
};

let nextSeq = 1;
const stack: Entry[] = [];
let listening = false;
let ignoring = false;
let unlockScroll: (() => void) | null = null;

/** Base stacking value. Each later overlay is 20 above the one below it. */
const Z_BASE = 5000;
const Z_STEP = 20;

function nextZ(): number {
  const top = stack[stack.length - 1];
  return top ? top.zIndex + Z_STEP : Z_BASE;
}

function ensureListener() {
  if (listening || typeof window === "undefined") return;
  listening = true;
  window.addEventListener("popstate", onPop);
  window.addEventListener("keydown", onKey, true);
}

function syncScrollLock() {
  const wants = stack.some((e) => e.locksScroll);
  if (wants && !unlockScroll) {
    unlockScroll = lockBodyScroll();
  } else if (!wants && unlockScroll) {
    unlockScroll();
    unlockScroll = null;
  }
}

function onPop() {
  if (ignoring) return;
  const top = stack.pop();
  if (!top) return;
  syncScrollLock();
  top.close();
}

function onKey(e: KeyboardEvent) {
  if (e.key !== "Escape") return;
  const top = stack[stack.length - 1];
  if (!top) return;
  e.preventDefault();
  e.stopPropagation();
  top.close();
}

export type PushOptions = {
  type?: OverlayType;
  close: () => void;
  /** Default true. Set false for overlays that should not freeze the page. */
  locksScroll?: boolean;
};

export type OverlayHandle = {
  id: string;
  /** Apply this as the surface z-index so later overlays paint above earlier ones. */
  zIndex: number;
  release: () => void;
};

/**
 * Register an overlay. Returns a handle with the z-index this surface must use
 * so it paints above whatever is already open. release is idempotent.
 */
export function pushOverlayEntry(opts: PushOptions): OverlayHandle {
  ensureListener();
  const id = `ov-${nextSeq++}`;
  const entry: Entry = {
    id,
    type: opts.type ?? "other",
    close: opts.close,
    locksScroll: opts.locksScroll !== false,
    zIndex: nextZ(),
  };
  stack.push(entry);
  try {
    history.pushState({ deckappOverlay: id }, "");
  } catch {
    /* history may be unavailable in some embeds */
  }
  syncScrollLock();

  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    const idx = stack.findIndex((e) => e.id === id);
    if (idx >= 0) stack.splice(idx, 1);
    syncScrollLock();
    const state = history.state as { deckappOverlay?: string } | null;
    if (state && state.deckappOverlay === id) {
      ignoring = true;
      try {
        history.back();
      } catch {
        /* ignore */
      }
      window.setTimeout(() => {
        ignoring = false;
      }, 50);
    }
  };
  return { id, zIndex: entry.zIndex, release };
}

/** Back-compat for existing call sites. Prefer pushOverlayEntry. */
export function pushOverlay(close: () => void): () => void {
  return pushOverlayEntry({ close, type: "other" }).release;
}

export function getTop(): { id: string; type: OverlayType } | null {
  const top = stack[stack.length - 1];
  return top ? { id: top.id, type: top.type } : null;
}

export function isTop(id: string): boolean {
  return stack[stack.length - 1]?.id === id;
}

export function peekNextZ(): number {
  return nextZ();
}

export function overlayCount(): number {
  return stack.length;
}
