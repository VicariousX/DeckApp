import { primaryTypeGroup } from "../cards/cardTypes";
import type { DeckCard, DeckTag } from "../../types/deck";

export type StatKind = "type" | "subtype" | "supertype" | "tag" | "oracle";

export type StatColumn = {
  id: string;
  label: string;
  kind: StatKind;
  value: string;
};

export type RecordBook = { wins: number; losses: number; draws: number };

const COL_STORE = "deckapp.statCols.";
const REC_STORE = "deckapp.record.";

export function mainboard(cards: DeckCard[]): DeckCard[] {
  return cards.filter((c) => c.board === "main" || c.board === "commander");
}

export function copies(cards: DeckCard[]): number {
  return cards.reduce((n, c) => n + (c.quantity || 1), 0);
}

export function manaCurve(cards: DeckCard[]): { bucket: string; count: number }[] {
  const bins = [0, 0, 0, 0, 0, 0, 0, 0];
  for (const c of mainboard(cards)) {
    if ((c.type_line || "").toLowerCase().includes("land")) continue;
    const cmc = Math.max(0, Math.round(c.cmc ?? 0));
    const i = Math.min(7, cmc);
    bins[i] += c.quantity || 1;
  }
  return bins.map((count, i) => ({
    bucket: i === 7 ? "7+" : String(i),
    count,
  }));
}

export function colorBalance(cards: DeckCard[]): { color: string; count: number }[] {
  const keys = ["W", "U", "B", "R", "G", "C"] as const;
  const tally: Record<string, number> = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };
  for (const c of mainboard(cards)) {
    const cost = c.mana_cost ?? "";
    const found = new Set<string>();
    for (const letter of keys) {
      if (letter !== "C" && cost.includes(`{${letter}`)) found.add(letter);
    }
    if (found.size === 0) found.add("C");
    for (const letter of found) tally[letter] += c.quantity || 1;
  }
  return keys.map((color) => ({ color, count: tally[color] }));
}

export function typeCounts(cards: DeckCard[]): { label: string; count: number }[] {
  const map = new Map<string, number>();
  for (const c of mainboard(cards)) {
    const g = primaryTypeGroup(c.type_line);
    map.set(g, (map.get(g) ?? 0) + (c.quantity || 1));
  }
  return [...map.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

export const SUPERTYPES = ["Basic", "Legendary", "Snow", "World", "Ongoing", "Host", "Elite"] as const;

export const CARD_TYPES = [
  "Creature",
  "Instant",
  "Sorcery",
  "Artifact",
  "Enchantment",
  "Planeswalker",
  "Land",
  "Battle",
  "Tribal",
  "Kindred",
] as const;

export function subtypesOf(typeLine: string): string[] {
  const part = typeLine.split("—")[1] ?? typeLine.split("-")[1] ?? "";
  return part
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function matchColumn(
  card: DeckCard,
  col: StatColumn,
  tags: DeckTag[],
  oracleByName?: Record<string, string>
): boolean {
  const q = col.value.trim().toLowerCase();
  if (!q) return false;
  const tl = card.type_line || "";
  if (col.kind === "type") return CARD_TYPES.some((t) => t.toLowerCase() === q && tl.toLowerCase().includes(q));
  if (col.kind === "subtype") {
    return subtypesOf(tl).some((s) => s.toLowerCase() === q);
  }
  if (col.kind === "supertype") {
    return SUPERTYPES.some((s) => s.toLowerCase() === q) && new RegExp(`\\b${q}\\b`, "i").test(tl);
  }
  if (col.kind === "oracle") {
    const text = (oracleByName?.[card.name.toLowerCase()] ?? card.notes ?? "").toLowerCase();
    return text.includes(q);
  }
  if (col.kind === "tag") {
    const tag = tags.find((t) => t.name.toLowerCase() === q || t.id === col.value);
    if (!tag) return false;
    return (card.tag_ids ?? []).includes(tag.id);
  }
  return false;
}

export function columnCount(
  cards: DeckCard[],
  col: StatColumn,
  tags: DeckTag[],
  oracleByName?: Record<string, string>
): number {
  return mainboard(cards)
    .filter((c) => matchColumn(c, col, tags, oracleByName))
    .reduce((n, c) => n + (c.quantity || 1), 0);
}

function logFact(n: number): number {
  let s = 0;
  for (let i = 2; i <= n; i++) s += Math.log(i);
  return s;
}

function logComb(n: number, k: number): number {
  if (k < 0 || k > n) return -Infinity;
  return logFact(n) - logFact(k) - logFact(n - k);
}

/** P(at least `need` hits in `seen` draws) via hypergeometric. */
export function drawAtLeast(N: number, K: number, seen: number, need: number): number {
  if (need <= 0) return 1;
  if (N <= 0 || seen <= 0 || K <= 0) return 0;
  if (need > K || need > seen) return 0;
  let p = 0;
  const max = Math.min(K, seen);
  for (let i = need; i <= max; i++) {
    p += Math.exp(logComb(K, i) + logComb(N - K, seen - i) - logComb(N, seen));
  }
  return Math.min(1, Math.max(0, p));
}

export function drawAtLeastOne(N: number, K: number, n: number): number {
  return drawAtLeast(N, K, n, 1);
}

export function loadColumns(deckId: string): StatColumn[] {
  try {
    const raw = localStorage.getItem(COL_STORE + deckId);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StatColumn[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveColumns(deckId: string, cols: StatColumn[]): void {
  try {
    localStorage.setItem(COL_STORE + deckId, JSON.stringify(cols));
  } catch {
    /* ignore */
  }
}

export function loadRecord(deckId: string): RecordBook {
  try {
    const raw = localStorage.getItem(REC_STORE + deckId);
    if (!raw) return { wins: 0, losses: 0, draws: 0 };
    const parsed = JSON.parse(raw) as RecordBook;
    return {
      wins: parsed.wins ?? 0,
      losses: parsed.losses ?? 0,
      draws: parsed.draws ?? 0,
    };
  } catch {
    return { wins: 0, losses: 0, draws: 0 };
  }
}

export function saveRecord(deckId: string, rec: RecordBook): void {
  try {
    localStorage.setItem(REC_STORE + deckId, JSON.stringify(rec));
  } catch {
    /* ignore */
  }
}
