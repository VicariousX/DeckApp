import { primaryTypeGroup } from "../cards/cardTypes";
import type { DeckCard, DeckTag } from "../../types/deck";

export type StatKind = "type" | "subtype" | "text" | "tag" | "name";

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
  tags: DeckTag[]
): boolean {
  const q = col.value.trim().toLowerCase();
  if (!q) return false;
  if (col.kind === "type") return (card.type_line || "").toLowerCase().includes(q);
  if (col.kind === "subtype") {
    return subtypesOf(card.type_line || "").some((s) => s.toLowerCase() === q);
  }
  if (col.kind === "text") {
    return (card.notes || "").toLowerCase().includes(q) || card.name.toLowerCase().includes(q);
  }
  if (col.kind === "name") return card.name.toLowerCase().includes(q);
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
  tags: DeckTag[]
): number {
  return mainboard(cards)
    .filter((c) => matchColumn(c, col, tags))
    .reduce((n, c) => n + (c.quantity || 1), 0);
}

/** P(at least one success in n draws) via hypergeometric. */
export function drawAtLeastOne(N: number, K: number, n: number): number {
  if (N <= 0 || n <= 0 || K <= 0) return 0;
  if (K >= N) return 1;
  let miss = 1;
  for (let i = 0; i < n; i++) {
    const remain = N - i;
    const missLeft = N - K - i;
    if (remain <= 0) break;
    if (missLeft <= 0) return 1;
    miss *= missLeft / remain;
  }
  return 1 - miss;
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
