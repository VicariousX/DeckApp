import type { DeckCard, DeckTag } from "../../types/deck";
import { primaryTypeGroup, sortTypeGroups } from "../cards/cardTypes";
import type { CardSortKey, DeckGroupMode } from "../deckPreferences";

export type CardGroup = { key: string; label: string; cards: DeckCard[] };

export function sortCards(cards: DeckCard[], sort: CardSortKey = "default"): DeckCard[] {
  return [...cards].sort((a, b) => {
    if (sort === "name") return a.name.localeCompare(b.name);
    if (sort === "cmc") return (a.cmc ?? 0) - (b.cmc ?? 0) || a.name.localeCompare(b.name);
    if (sort === "type") return (a.type_line || "").localeCompare(b.type_line || "") || a.name.localeCompare(b.name);
    if (sort === "qty") return (b.quantity || 0) - (a.quantity || 0) || a.name.localeCompare(b.name);
    const so = (a.sort_order ?? 0) - (b.sort_order ?? 0);
    if (so !== 0) return so;
    return a.name.localeCompare(b.name);
  });
}

export function filterCards(cards: DeckCard[], q: string): DeckCard[] {
  const s = q.trim().toLowerCase();
  if (!s) return cards;
  return cards.filter(
    (c) =>
      c.name.toLowerCase().includes(s) ||
      (c.type_line || "").toLowerCase().includes(s) ||
      (c.notes || "").toLowerCase().includes(s)
  );
}

/** Image-view qty controls only for basic lands (repeatable). */
export function isBasicLand(card: DeckCard): boolean {
  const tl = card.type_line ?? "";
  return /\bBasic\b/i.test(tl) && /\bLand\b/i.test(tl);
}

export function buildGroups(
  cards: DeckCard[],
  groupMode: DeckGroupMode,
  tags: DeckTag[]
): CardGroup[] {
  const sorted = sortCards(cards);
  if (groupMode === "none" || groupMode === "grid") {
    return [{ key: "all", label: "All cards", cards: sorted }];
  }
  if (groupMode === "type") {
    const map = new Map<string, DeckCard[]>();
    for (const c of sorted) {
      const g = primaryTypeGroup(c.type_line);
      const list = map.get(g) ?? [];
      list.push(c);
      map.set(g, list);
    }
    return sortTypeGroups([...map.keys()]).map((k) => ({
      key: k,
      label: k,
      cards: sortCards(map.get(k) ?? []),
    }));
  }
  const byTag = new Map<string, DeckCard[]>();
  const untagged: DeckCard[] = [];
  for (const c of sorted) {
    const ids = c.tag_ids ?? [];
    if (ids.length === 0) {
      untagged.push(c);
      continue;
    }
    for (const tid of ids) {
      const list = byTag.get(tid) ?? [];
      list.push(c);
      byTag.set(tid, list);
    }
  }
  const sections = tags
    .filter((t) => byTag.has(t.id))
    .map((t) => ({
      key: t.id,
      label: t.name,
      cards: sortCards(byTag.get(t.id) ?? []),
    }));
  if (untagged.length) {
    sections.push({
      key: "untagged",
      label: "Untagged",
      cards: sortCards(untagged),
    });
  }
  return sections;
}
