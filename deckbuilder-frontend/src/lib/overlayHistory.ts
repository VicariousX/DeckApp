/** Stack of open overlays so the mobile back button closes the top one first. */
type Entry = { id: number; close: () => void };

let nextId = 1;
const stack: Entry[] = [];
let listening = false;

function onPop() {
  const top = stack.pop();
  if (top) top.close();
}

function ensureListener() {
  if (listening || typeof window === "undefined") return;
  listening = true;
  window.addEventListener("popstate", onPop);
}

export function pushOverlay(close: () => void): () => void {
  ensureListener();
  const entry: Entry = { id: nextId++, close };
  stack.push(entry);
  history.pushState({ deckappOverlay: entry.id }, "");
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const idx = stack.findIndex((e) => e.id === entry.id);
    if (idx >= 0) stack.splice(idx, 1);
    if (history.state && (history.state as { deckappOverlay?: number }).deckappOverlay === entry.id) {
      history.back();
    }
  };
}
