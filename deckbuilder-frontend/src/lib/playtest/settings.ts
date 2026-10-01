import type { TableJournal, TableState } from "./types";

export type MulliganKind = "london" | "paris" | "free";

export type PlaySettings = {
  openingHand: number;
  startingLife: number | null;
  mulligan: MulliganKind;
  drawCount: number;
  scryCount: number;
  millCount: number;
  nextTurnUntap: boolean;
  nextTurnDraw: number;
  showXGlyph: boolean;
  boardScale: number;
  handScale: number;
  hideHand: boolean;
  playmat: "plain" | "felt" | "arcane";
  show: {
    newGame: boolean;
    draw: boolean;
    mulligan: boolean;
    nextTurn: boolean;
    shuffle: boolean;
    mill: boolean;
    scry: boolean;
    undo: boolean;
    dice: boolean;
  };
};

const KEY = "deckapp.playSettings";

export const DEFAULT_PLAY_SETTINGS: PlaySettings = {
  openingHand: 7,
  startingLife: null,
  mulligan: "london",
  drawCount: 1,
  scryCount: 1,
  millCount: 1,
  nextTurnUntap: true,
  nextTurnDraw: 1,
  showXGlyph: true,
  boardScale: 1,
  handScale: 1,
  hideHand: false,
  playmat: "felt",
  show: {
    newGame: true,
    draw: true,
    mulligan: true,
    nextTurn: true,
    shuffle: true,
    mill: true,
    scry: true,
    undo: true,
    dice: true,
  },
};

export function loadPlaySettings(): PlaySettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_PLAY_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<PlaySettings>;
    return {
      ...DEFAULT_PLAY_SETTINGS,
      ...parsed,
      show: { ...DEFAULT_PLAY_SETTINGS.show, ...parsed.show },
      assistants: { ...DEFAULT_PLAY_SETTINGS.assistants, ...parsed.assistants },
    };
  } catch {
    return DEFAULT_PLAY_SETTINGS;
  }
}

export function savePlaySettings(s: PlaySettings) {
  localStorage.setItem(KEY, JSON.stringify(s));
}

const TABLE_KEY = "deckapp.playTable.";

export function loadLiveTable(deckId: string): TableState | null {
  try {
    const raw = localStorage.getItem(TABLE_KEY + deckId);
    if (!raw) return null;
    return JSON.parse(raw) as TableState;
  } catch {
    return null;
  }
}

export function saveLiveTable(deckId: string, state: TableState) {
  try {
    localStorage.setItem(TABLE_KEY + deckId, JSON.stringify(state));
  } catch {
    /* quota */
  }
}

export function clearLiveTable(deckId: string) {
  localStorage.removeItem(TABLE_KEY + deckId);
  localStorage.removeItem(TABLE_KEY + deckId + ".journal");
}

export function loadJournal(deckId: string): TableJournal | null {
  try {
    const raw = localStorage.getItem(TABLE_KEY + deckId + ".journal");
    if (!raw) return null;
    return JSON.parse(raw) as TableJournal;
  } catch {
    return null;
  }
}

export function saveJournal(deckId: string, journal: TableJournal) {
  try {
    localStorage.setItem(TABLE_KEY + deckId + ".journal", JSON.stringify(journal));
  } catch {
    /* quota */
  }
}
