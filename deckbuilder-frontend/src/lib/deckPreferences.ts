/** Local preferences for deck UX (view mode, last opened deck, list columns). */

const VIEW_MODE_KEY = "deckapp.deckViewMode";
const GROUP_MODE_KEY = "deckapp.deckGroupMode";
const LAST_DECK_KEY = "deckapp.lastViewedDeck";
const LIST_COLS_PREFIX = "deckapp.listColumns.";

export type DeckViewMode = "text" | "image";
export type DeckGroupMode = "type" | "tag" | "none";

export type LastViewedDeck = {
  id: string;
  name: string;
};

/** Freeform columns for Images + List mode (per deck + board). */
export type ListColumn = {
  id: string;
  name: string;
};

export type ListColumnLayout = {
  columns: ListColumn[];
  /** deck_card id → column id */
  placement: Record<string, string>;
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

export function getDeckGroupMode(): DeckGroupMode {
  try {
    const v = localStorage.getItem(GROUP_MODE_KEY);
    if (v === "tag" || v === "none" || v === "type") return v;
    return "type";
  } catch {
    return "type";
  }
}

export function setDeckGroupMode(mode: DeckGroupMode): void {
  try {
    localStorage.setItem(GROUP_MODE_KEY, mode);
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

function listColsKey(deckId: string, board: string): string {
  return `${LIST_COLS_PREFIX}${deckId}.${board}`;
}

export function getListColumnLayout(
  deckId: string,
  board: string
): ListColumnLayout {
  try {
    const raw = localStorage.getItem(listColsKey(deckId, board));
    if (!raw) {
      return {
        columns: [{ id: "col-default", name: "Cards" }],
        placement: {},
      };
    }
    const parsed = JSON.parse(raw) as ListColumnLayout;
    if (!Array.isArray(parsed.columns) || parsed.columns.length === 0) {
      return {
        columns: [{ id: "col-default", name: "Cards" }],
        placement: {},
      };
    }
    return {
      columns: parsed.columns,
      placement: parsed.placement ?? {},
    };
  } catch {
    return {
      columns: [{ id: "col-default", name: "Cards" }],
      placement: {},
    };
  }
}

export function setListColumnLayout(
  deckId: string,
  board: string,
  layout: ListColumnLayout
): void {
  try {
    localStorage.setItem(listColsKey(deckId, board), JSON.stringify(layout));
  } catch {
    /* ignore */
  }
}

export function newListColumnId(): string {
  return `col-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
