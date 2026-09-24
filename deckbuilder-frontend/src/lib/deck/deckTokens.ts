import type { ScryfallCard } from "../../types/scryfallCard";

export type TokenKind = "token" | "extra";

export type DeckToken = {
  id: string;
  name: string;
  type_line: string;
  image?: string;
  quantity: number;
  kind: TokenKind;
  sources: string[];
  included: boolean;
  source: "auto" | "manual";
};

const STORE = "deckapp.deckTokens.";

export function classifyPart(
  component: string,
  typeLine: string
): TokenKind | null {
  const t = (typeLine || "").toLowerCase();
  if (component === "token" || t.includes("token")) return "token";
  if (
    t.includes("emblem") ||
    t.includes("dungeon") ||
    t.includes("the monarch") ||
    t.includes("the initiative") ||
    t.includes("plane ") ||
    t.includes("phenomenon")
  ) {
    return "extra";
  }
  return null;
}

export function partsFromCard(card: ScryfallCard): {
  id: string;
  name: string;
  type_line: string;
  kind: TokenKind;
}[] {
  const out: { id: string; name: string; type_line: string; kind: TokenKind }[] = [];
  for (const p of card.all_parts ?? []) {
    if (p.id === card.id) continue;
    const kind = classifyPart(p.component, p.type_line);
    if (!kind) continue;
    out.push({
      id: p.id,
      name: p.name,
      type_line: p.type_line,
      kind,
    });
  }
  return out;
}

/** Collapse printings of the same token (Treasure, Soldier, …). */
export function tokenDedupeKey(t: { name: string }): string {
  return t.name
    .toLowerCase()
    .replace(/\s+token$/i, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function mergePieces(
  auto: DeckToken[],
  previous: DeckToken[]
): DeckToken[] {
  const prevById = new Map(previous.map((t) => [t.id, t]));
  const byKey = new Map<string, DeckToken>();
  for (const t of auto) {
    const key = tokenDedupeKey(t);
    const existing = byKey.get(key);
    if (existing) {
      for (const s of t.sources) {
        if (!existing.sources.includes(s)) existing.sources.push(s);
      }
      if (!existing.image && t.image) existing.image = t.image;
      continue;
    }
    const prev = prevById.get(t.id);
    byKey.set(key, {
      ...t,
      included: prev?.included ?? true,
      quantity: prev?.quantity ?? 1,
    });
  }
  const byId = new Map<string, DeckToken>();
  for (const t of byKey.values()) byId.set(t.id, t);
  for (const t of previous) {
    if (t.source === "manual" && !byId.has(t.id)) byId.set(t.id, t);
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function loadDeckTokens(deckId: string): DeckToken[] {
  try {
    const raw = localStorage.getItem(STORE + deckId);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DeckToken[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((t) => t && typeof t.id === "string" && Array.isArray(t.sources));
  } catch {
    return [];
  }
}

export function saveDeckTokens(deckId: string, tokens: DeckToken[]): void {
  try {
    localStorage.setItem(STORE + deckId, JSON.stringify(tokens));
  } catch {
    /* ignore */
  }
}

export async function generateDeckTokens(
  deckCards: { name: string }[],
  previous: DeckToken[]
): Promise<{ tokens: DeckToken[]; error: string | null }> {
  const { fetchCardsByNames, fetchCollectionByIds } = await import("../scryfallApi");
  const names = [...new Set(deckCards.map((c) => c.name))];
  const { byName, error: nErr } = await fetchCardsByNames(names);
  if (nErr && byName.size === 0) return { tokens: previous, error: nErr };
  const sources = new Map<
    string,
    { name: string; type_line: string; kind: TokenKind; from: string[] }
  >();
  for (const deckCard of deckCards) {
    const full = byName.get(deckCard.name.toLowerCase());
    if (!full) continue;
    for (const part of partsFromCard(full)) {
      const cur = sources.get(part.id);
      if (cur) {
        if (!cur.from.includes(deckCard.name)) cur.from.push(deckCard.name);
      } else {
        sources.set(part.id, {
          name: part.name,
          type_line: part.type_line,
          kind: part.kind,
          from: [deckCard.name],
        });
      }
    }
  }
  const ids = [...sources.keys()];
  const { cards: parts, error: pErr } = await fetchCollectionByIds(ids);
  const byId = new Map(parts.map((c) => [c.id, c]));
  const auto: DeckToken[] = ids.map((id) => {
    const meta = sources.get(id)!;
    const card = byId.get(id);
    return {
      id,
      name: card?.name ?? meta.name,
      type_line: card?.type_line ?? meta.type_line,
      image: card ? tokenImage(card) : undefined,
      quantity: 1,
      kind: meta.kind,
      sources: meta.from,
      included: true,
      source: "auto" as const,
    };
  });
  return { tokens: mergePieces(auto, previous), error: pErr };
}

export function tokenImage(card: ScryfallCard): string | undefined {
  return (
    card.image_uris?.normal ||
    card.image_uris?.small ||
    card.card_faces?.[0]?.image_uris?.normal ||
    card.card_faces?.[0]?.image_uris?.small
  );
}
