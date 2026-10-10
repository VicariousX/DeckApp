import type { DeckCard } from "../types/deck";

export type DeckSnapshot = {
  at: string;
  label: string;
  cards: Pick<
    DeckCard,
    "oracle_id" | "scryfall_id" | "name" | "type_line" | "mana_cost" | "cmc" | "quantity" | "board"
  >[];
};

const MAX = 12;

function key(deckId: string) {
  return `deckapp-history:${deckId}`;
}

export function loadHistory(deckId: string): DeckSnapshot[] {
  try {
    const raw = localStorage.getItem(key(deckId));
    const list = raw ? (JSON.parse(raw) as DeckSnapshot[]) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function rememberDeck(deckId: string, cards: DeckCard[], label: string) {
  const snap: DeckSnapshot = {
    at: new Date().toISOString(),
    label,
    cards: cards.map((c) => ({
      oracle_id: c.oracle_id,
      scryfall_id: c.scryfall_id,
      name: c.name,
      type_line: c.type_line,
      mana_cost: c.mana_cost,
      cmc: c.cmc,
      quantity: c.quantity,
      board: c.board,
    })),
  };
  const next = [snap, ...loadHistory(deckId)].slice(0, MAX);
  localStorage.setItem(key(deckId), JSON.stringify(next));
}

export function loadBranchParent(deckId: string): string | null {
  try {
    const map = JSON.parse(localStorage.getItem("deckapp-branches") || "{}") as Record<string, string>;
    return map[deckId] || null;
  } catch {
    return null;
  }
}

export function saveBranchParent(deckId: string, parentId: string) {
  const map = JSON.parse(localStorage.getItem("deckapp-branches") || "{}") as Record<string, string>;
  map[deckId] = parentId;
  localStorage.setItem("deckapp-branches", JSON.stringify(map));
}
