import type { DeckCard, DeckTag } from "../../types/deck";
import { primaryTypeGroup, sortTypeGroups } from "../cards/cardTypes";
import type { CardSortKey, DeckGroupMode, SortDir } from "../deckPreferences";

export type CardGroup = { key: string; label: string; cards: DeckCard[] };

export function sortCards(
  cards: DeckCard[],
  sort: CardSortKey = "default",
  dir: SortDir = "asc"
): DeckCard[] {
  const mul = dir === "desc" ? -1 : 1;
  return [...cards].sort((a, b) => {
    let cmp = 0;
    if (sort === "name") cmp = a.name.localeCompare(b.name);
    else if (sort === "cmc") cmp = (a.cmc ?? 0) - (b.cmc ?? 0) || a.name.localeCompare(b.name);
    else if (sort === "type") cmp = (a.type_line || "").localeCompare(b.type_line || "") || a.name.localeCompare(b.name);
    else if (sort === "qty") cmp = (a.quantity || 0) - (b.quantity || 0) || a.name.localeCompare(b.name);
    else {
      cmp = (a.sort_order ?? 0) - (b.sort_order ?? 0);
      if (cmp === 0) cmp = a.name.localeCompare(b.name);
    }
    return cmp * mul;
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
  tags: DeckTag[],
  sort: CardSortKey = "default",
  dir: SortDir = "asc"
): CardGroup[] {
  const sorted = sortCards(cards, sort, dir);
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
      cards: sortCards(map.get(k) ?? [], sort, dir),
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
      cards: sortCards(byTag.get(t.id) ?? [], sort, dir),
    }));
  if (untagged.length) {
    sections.push({
      key: "untagged",
      label: "Untagged",
      cards: sortCards(untagged, sort, dir),
    });
  }
  return sections;
}
