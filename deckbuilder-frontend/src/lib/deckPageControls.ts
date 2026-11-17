import type { ReactNode } from "react";
import type { CardSortKey, DeckViewMode, SortDir } from "./deckPreferences";

export type DeckGroupMode = "type" | "tag" | "none" | "grid";

export type DeckPageControls = {
  viewMode: DeckViewMode;
  groupMode: DeckGroupMode;
  cardSort: CardSortKey;
  sortDir: SortDir;
  formatId: string;
  formats: { id: string; name: string }[];
  isOwner: boolean;
  tools: ReactNode;
  setGroup: (mode: DeckGroupMode) => void;
  setSort: (sort: CardSortKey) => void;
  setDir: (dir: SortDir) => void;
  setFormat: (id: string) => void;
};

let current: DeckPageControls | null = null;
const listeners = new Set<() => void>();

export function publishDeckPageControls(next: DeckPageControls | null) {
  current = next;
  listeners.forEach((listener) => listener());
}

export function subscribeDeckPageControls(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getDeckPageControls() {
  return current;
}
