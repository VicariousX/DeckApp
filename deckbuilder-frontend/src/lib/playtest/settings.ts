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
    };
  } catch {
    return DEFAULT_PLAY_SETTINGS;
  }
}

export function savePlaySettings(s: PlaySettings) {
  localStorage.setItem(KEY, JSON.stringify(s));
}
