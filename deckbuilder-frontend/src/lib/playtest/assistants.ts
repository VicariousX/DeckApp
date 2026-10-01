import type { PlayCard, TableState } from "./types";

export function effectiveToughness(card: PlayCard): number | null {
  if (typeof card.toughness !== "number" && card.counters.toughness == null) return null;
  const base = typeof card.toughness === "number" ? card.toughness : card.counters.toughness ?? 0;
  const plus = card.counters["+1/+1"] ?? 0;
  const minus = card.counters["-1/-1"] ?? 0;
  return base + plus - minus;
}

export function deadCreatures(table: TableState): PlayCard[] {
  const out: PlayCard[] = [];
  for (const seat of table.seats) {
    for (const card of seat.zones.battlefield) {
      if (!/\bcreature\b/i.test(card.typeLine || "")) continue;
      const t = effectiveToughness(card);
      if (t != null && t <= 0) out.push(card);
    }
  }
  return out;
}

export function legendClashes(table: TableState): { name: string; cards: PlayCard[] }[] {
  const byName = new Map<string, PlayCard[]>();
  for (const seat of table.seats) {
    for (const card of seat.zones.battlefield) {
      if (card.token && /copy/i.test(card.name)) continue;
      if (!/\blegendary\b/i.test(card.typeLine || "")) continue;
      const key = card.name.toLowerCase();
      const list = byName.get(key) ?? [];
      list.push(card);
      byName.set(key, list);
    }
  }
  return [...byName.entries()]
    .filter(([, cards]) => cards.length > 1)
    .map(([name, cards]) => ({ name, cards }));
}

const PIP: Record<string, string> = { w: "w", u: "u", b: "b", r: "r", g: "g", c: "c" };

export function parseCost(raw: string): { generic: number; pips: string[] } | null {
  const text = raw.trim();
  if (!text) return null;
  let generic = 0;
  const pips: string[] = [];
  const parts = text.match(/\{[^}]+\}|[0-9]+|[WUBRGC]/gi) ?? [text];
  for (const part of parts) {
    const p = part.replace(/[{}]/g, "");
    if (/^\d+$/.test(p)) generic += Number(p);
    else if (PIP[p.toLowerCase()]) pips.push(PIP[p.toLowerCase()]);
    else return null;
  }
  return { generic, pips };
}

export function suggestLandTaps(cards: PlayCard[], raw: string): string[] | null {
  const cost = parseCost(raw);
  if (!cost) return null;
  const lands = cards.filter((c) => !c.tapped && /\bland\b/i.test(c.typeLine || ""));
  const chosen: PlayCard[] = [];
  const need = new Map<string, number>();
  for (const p of cost.pips) need.set(p, (need.get(p) ?? 0) + 1);
  for (const [color, n] of need) {
    const pool = lands.filter((c) => !chosen.includes(c) && landProduces(c, color));
    if (pool.length < n) return null;
    chosen.push(...pool.slice(0, n));
  }
  const genericLeft = cost.generic;
  const rest = lands.filter((c) => !chosen.includes(c));
  if (rest.length < genericLeft) return null;
  chosen.push(...rest.slice(0, genericLeft));
  return chosen.map((c) => c.instanceId);
}

function landProduces(card: PlayCard, color: string): boolean {
  const line = `${card.name} ${card.typeLine} ${card.manaCost}`.toLowerCase();
  if (color === "c") return /\bland\b/.test(line);
  const name: Record<string, string> = { w: "plains", u: "island", b: "swamp", r: "mountain", g: "forest" };
  return line.includes(name[color] ?? color);
}
