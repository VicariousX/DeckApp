export type ComboCard = {
  id: string;
  oracle_id: string;
  scryfall_id: string;
  name: string;
  type_line: string;
  image?: string;
};

export type ComboColumn = {
  id: string;
  label: string;
  face: number;
  cards: ComboCard[];
};

export type ComboLock = {
  id: string;
  name: string;
  columns: ComboColumn[];
  updated_at: string;
};

const PREFIX = "deckapp.combos.";

function key(userId: string | null): string {
  return PREFIX + (userId ?? "anon");
}

export function newColumn(label = ""): ComboColumn {
  return {
    id: `col-${crypto.randomUUID()}`,
    label,
    face: 0,
    cards: [],
  };
}

export function newCombo(name = "New combo"): ComboLock {
  return {
    id: `cmb-${crypto.randomUUID()}`,
    name,
    columns: [newColumn("Piece A"), newColumn("Piece B")],
    updated_at: new Date().toISOString(),
  };
}

export function loadCombos(userId: string | null): ComboLock[] {
  try {
    const raw = localStorage.getItem(key(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ComboLock[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCombos(userId: string | null, combos: ComboLock[]): void {
  try {
    localStorage.setItem(key(userId), JSON.stringify(combos));
  } catch {
    /* ignore quota */
  }
}

export function pairingCount(combo: ComboLock): number {
  const sizes = combo.columns.map((c) => c.cards.length).filter((n) => n > 0);
  if (sizes.length === 0) return 0;
  return sizes.reduce((a, b) => a * b, 1);
}
