import type { ScryfallCard } from "../types/scryfallCard";

const BASE = "http://127.0.0.1:3001";

export async function fetchCardById(
  id: string
): Promise<{ card: ScryfallCard | null; error: string | null }> {
  try {
    const res = await fetch(
      `${BASE}/api/scryfall/card/${encodeURIComponent(id)}`
    );
    const data = await res.json();
    if (!res.ok) {
      return {
        card: null,
        error: data?.details ?? data?.error ?? "Card not found",
      };
    }
    return { card: data as ScryfallCard, error: null };
  } catch {
    return { card: null, error: "Network error loading card" };
  }
}

export async function fetchAutocomplete(
  q: string
): Promise<{ names: string[]; error: string | null }> {
  const trimmed = q.trim();
  if (trimmed.length < 2) return { names: [], error: null };
  try {
    const res = await fetch(
      `${BASE}/api/scryfall/autocomplete?q=${encodeURIComponent(trimmed)}`
    );
    const data = await res.json();
    if (!res.ok) {
      return { names: [], error: data?.error ?? "Autocomplete failed" };
    }
    return { names: (data.data as string[]) ?? [], error: null };
  } catch {
    return { names: [], error: "Network error" };
  }
}

export async function fetchNamedCard(
  name: string,
  mode: "exact" | "fuzzy" = "exact"
): Promise<{ card: ScryfallCard | null; error: string | null }> {
  const param = mode === "exact" ? "exact" : "fuzzy";
  try {
    const res = await fetch(
      `${BASE}/api/scryfall/named?${param}=${encodeURIComponent(name)}`
    );
    const data = await res.json();
    if (!res.ok) {
      return {
        card: null,
        error: data?.details ?? data?.error ?? "Card not found",
      };
    }
    return { card: data as ScryfallCard, error: null };
  } catch {
    return { card: null, error: "Network error" };
  }
}

export async function fetchPrintings(
  oracleId: string
): Promise<{ cards: ScryfallCard[]; error: string | null }> {
  try {
    const res = await fetch(
      `${BASE}/api/scryfall/prints?oracle_id=${encodeURIComponent(oracleId)}`
    );
    const data = await res.json();
    if (!res.ok) {
      return {
        cards: [],
        error: data?.details ?? data?.error ?? "Could not load printings",
      };
    }
    return { cards: (data.data as ScryfallCard[]) ?? [], error: null };
  } catch {
    return { cards: [], error: "Network error loading printings" };
  }
}

/** Resolve up to 75 card names via Scryfall /cards/collection (batched by caller). */
export async function fetchCollectionByNames(
  names: string[]
): Promise<{
  cards: ScryfallCard[];
  notFound: string[];
  error: string | null;
}> {
  if (names.length === 0) return { cards: [], notFound: [], error: null };
  try {
    const identifiers = names.map((name) => ({ name }));
    const res = await fetch(`${BASE}/api/scryfall/collection`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifiers }),
    });
    const data = await res.json();
    if (!res.ok) {
      return {
        cards: [],
        notFound: names,
        error: data?.details ?? data?.error ?? "Collection lookup failed",
      };
    }
    const cards = (data.data as ScryfallCard[]) ?? [];
    const notFound = ((data.not_found as { name?: string }[]) ?? [])
      .map((n) => n.name)
      .filter((n): n is string => Boolean(n));
    return { cards, notFound, error: null };
  } catch {
    return { cards: [], notFound: names, error: "Network error" };
  }
}

/** Batch resolve names (chunks of 75). */
export async function fetchCardsByNames(
  names: string[]
): Promise<{
  byName: Map<string, ScryfallCard>;
  notFound: string[];
  error: string | null;
}> {
  const byName = new Map<string, ScryfallCard>();
  const notFound: string[] = [];
  const unique = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
  for (let i = 0; i < unique.length; i += 75) {
    const chunk = unique.slice(i, i + 75);
    const { cards, notFound: nf, error } = await fetchCollectionByNames(chunk);
    if (error && cards.length === 0) {
      return { byName, notFound: [...notFound, ...chunk], error };
    }
    for (const c of cards) {
      byName.set(c.name.toLowerCase(), c);
      // Also index front face name for DFCs if different
      const face0 = c.card_faces?.[0]?.name;
      if (face0) byName.set(face0.toLowerCase(), c);
    }
    notFound.push(...nf);
  }
  return { byName, notFound, error: null };
}
