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

export type CardFilterFacts = {
  oracle?: string;
  colors?: string[];
  identity?: string[];
  cmc?: number | null;
};

const COLOR_WORDS: Record<string, string> = {
  w: "W", u: "U", b: "B", r: "R", g: "G", c: "C",
  white: "W", blue: "U", black: "B", red: "R", green: "G", colorless: "C",
  azorius: "WU", dimir: "UB", rakdos: "BR", gruul: "RG", selesnya: "GW",
  orzhov: "WB", izzet: "UR", golgari: "BG", boros: "RW", simic: "GU",
  bant: "GWU", esper: "WUB", grixis: "UBR", jund: "BRG", naya: "RGW",
  mardu: "RWB", temur: "GUR", abzan: "WBG", jeskai: "URW", sultai: "BGU",
};

function colorLetters(token: string): string[] {
  const key = token.toLowerCase();
  if (COLOR_WORDS[key]) return COLOR_WORDS[key].split("");
  return key.toUpperCase().split("").filter((letter) => "WUBRGC".includes(letter));
}

function hasColors(have: string[], need: string[]): boolean {
  const set = new Set(have.map((c) => c.toUpperCase()));
  return need.every((letter) => (letter === "C" ? set.size === 0 : set.has(letter)));
}

function compare(value: number, op: string, target: number): boolean {
  if (op === "<") return value < target;
  if (op === ">") return value > target;
  if (op === "<=") return value <= target;
  if (op === ">=") return value >= target;
  return value === target;
}

export function filterCards(
  cards: DeckCard[],
  q: string,
  facts: Record<string, CardFilterFacts> = {}
): DeckCard[] {
  const raw = q.trim();
  if (!raw) return cards;
  const checks: Array<(card: DeckCard, fact?: CardFilterFacts) => boolean> = [];
  let rest = ` ${raw} `;

  rest = rest.replace(
    /(?:^|\s)(?:mv|cmc|mana(?:\s+value)?)\s*(<=|>=|<|>|=|:)?\s*(\d+(?:\.\d+)?)(?=\s|$)/gi,
    (_m, op: string | undefined, n: string) => {
      const target = Number(n);
      const operator = !op || op === ":" ? "=" : op;
      checks.push((card, fact) => compare(card.cmc ?? fact?.cmc ?? 0, operator, target));
      return " ";
    }
  );
  rest = rest.replace(
    /(?:^|\s)(?:id|ci|identity)\s*:\s*([a-z]+)(?=\s|$)/gi,
    (_m, token: string) => {
      const need = colorLetters(token);
      checks.push((_card, fact) => hasColors(fact?.identity ?? [], need));
      return " ";
    }
  );
  rest = rest.replace(
    /(?:^|\s)(?:c|color|colors)\s*:\s*([a-z]+)(?=\s|$)/gi,
    (_m, token: string) => {
      const need = colorLetters(token);
      checks.push((_card, fact) => hasColors(fact?.colors ?? fact?.identity ?? [], need));
      return " ";
    }
  );

  const text = rest.trim().toLowerCase();
  if (text) {
    const words = text.split(/\s+/).filter(Boolean);
    checks.push((card, fact) => {
      const blob = [card.name, card.type_line, card.notes, fact?.oracle]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return words.every((word) => blob.includes(word));
    });
  }
  return cards.filter((card) => {
    const fact = facts[card.oracle_id?.toLowerCase()] ?? facts[card.id?.toLowerCase()];
    return checks.every((check) => check(card, fact));
  });
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
