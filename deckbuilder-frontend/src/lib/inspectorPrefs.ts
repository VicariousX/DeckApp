/**
 * Persists the inspector modal's "image shown" preference across opens
 * without a module-level mutable that other systems have to know about.
 */
const KEY = "deckapp.inspector.imageShown";

export function readImageShown(): boolean {
  try {
    const v = localStorage.getItem(KEY);
    if (v === null) return true;
    return v !== "0";
  } catch {
    return true;
  }
}

export function writeImageShown(shown: boolean) {
  try {
    localStorage.setItem(KEY, shown ? "1" : "0");
  } catch {
    /* ignore */
  }
}
