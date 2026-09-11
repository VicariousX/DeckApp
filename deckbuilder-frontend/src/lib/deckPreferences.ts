/** Local preferences for deck UX (view mode, last opened deck). */

const VIEW_MODE_KEY = "deckapp.deckViewMode";
const LAST_DECK_KEY = "deckapp.lastViewedDeck";

export type DeckViewMode = "text" | "image";

export type LastViewedDeck = {
  id: string;
  name: string;
};

export function getDeckViewMode(): DeckViewMode {
  try {
    const v = localStorage.getItem(VIEW_MODE_KEY);
    return v === "image" ? "image" : "text";
  } catch {
    return "text";
  }
}

export function setDeckViewMode(mode: DeckViewMode): void {
  try {
    localStorage.setItem(VIEW_MODE_KEY, mode);
  } catch {
    /* ignore */
  }
}

export function getLastViewedDeck(): LastViewedDeck | null {
  try {
    const raw = localStorage.getItem(LAST_DECK_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LastViewedDeck;
    if (parsed?.id && parsed?.name) return parsed;
    return null;
  } catch {
    return null;
  }
}

export function setLastViewedDeck(deck: LastViewedDeck): void {
  try {
    localStorage.setItem(LAST_DECK_KEY, JSON.stringify(deck));
  } catch {
    /* ignore */
  }
}
