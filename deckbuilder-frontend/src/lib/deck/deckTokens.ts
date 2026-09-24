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

export function mergePieces(
  auto: DeckToken[],
  previous: DeckToken[]
): DeckToken[] {
  const prevById = new Map(previous.map((t) => [t.id, t]));
  const byId = new Map<string, DeckToken>();
  for (const t of auto) {
    const prev = prevById.get(t.id);
    byId.set(t.id, {
      ...t,
      included: prev?.included ?? true,
      quantity: prev?.quantity ?? 1,
    });
  }
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

export function tokenImage(card: ScryfallCard): string | undefined {
  return (
    card.image_uris?.normal ||
    card.image_uris?.small ||
    card.card_faces?.[0]?.image_uris?.normal ||
    card.card_faces?.[0]?.image_uris?.small
  );
}
