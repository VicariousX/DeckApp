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
};

let nextSeq = 1;
const stack: Entry[] = [];
let listening = false;
let ignoring = false;
let unlockScroll: (() => void) | null = null;

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

/**
 * Register an overlay. Returns a release function to call on close/unmount.
 * The release is idempotent.
 */
export function pushOverlayEntry(opts: PushOptions): () => void {
  ensureListener();
  const id = `ov-${nextSeq++}`;
  const entry: Entry = {
    id,
    type: opts.type ?? "other",
    close: opts.close,
    locksScroll: opts.locksScroll !== false,
  };
  stack.push(entry);
  try {
    history.pushState({ deckappOverlay: id }, "");
  } catch {
    /* history may be unavailable in some embeds */
  }
  syncScrollLock();

  let released = false;
  return () => {
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
}

/** Back-compat for existing call sites. Prefer pushOverlayEntry. */
export function pushOverlay(close: () => void): () => void {
  return pushOverlayEntry({ close, type: "other" });
}

export function getTop(): { id: string; type: OverlayType } | null {
  const top = stack[stack.length - 1];
  return top ? { id: top.id, type: top.type } : null;
}

export function isTop(id: string): boolean {
  return stack[stack.length - 1]?.id === id;
}

export function overlayCount(): number {
  return stack.length;
}
