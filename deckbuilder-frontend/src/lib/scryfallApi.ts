import type { ScryfallCard } from "../types/scryfallCard";

const BASE = "http://127.0.0.1:3001";

/** Client-side card cache (by scryfall id) — cuts repeat modal/search traffic. */
const cardCache = new Map<string, ScryfallCard>();
const cardInflight = new Map<
  string,
  Promise<{ card: ScryfallCard | null; error: string | null }>
>();

const printCache = new Map<string, ScryfallCard[]>();
const printInflight = new Map<
  string,
  Promise<{ cards: ScryfallCard[]; error: string | null }>
>();

function normId(id: string): string {
  return id.trim().toLowerCase();
}

export async function fetchRandomCard(): Promise<{
  card: ScryfallCard | null;
  error: string | null;
}> {
  try {
    const res = await fetch(`${BASE}/api/scryfall/random`);
    const data = await res.json();
    if (!res.ok) {
      return {
        card: null,
        error: data?.details ?? data?.error ?? "Random card failed",
      };
    }
    const card = data as ScryfallCard;
    if (card.id) cardCache.set(normId(card.id), card);
    return { card, error: null };
  } catch {
    return { card: null, error: "Network error loading random card" };
  }
}

export async function fetchCardById(
  id: string
): Promise<{ card: ScryfallCard | null; error: string | null }> {
  const key = normId(id);
  if (!key) return { card: null, error: "Missing card id" };

  const cached = cardCache.get(key);
  if (cached) return { card: cached, error: null };

  const pending = cardInflight.get(key);
  if (pending) return pending;

  const promise = (async () => {
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
      const card = data as ScryfallCard;
      cardCache.set(key, card);
      if (card.id) cardCache.set(normId(card.id), card);
      return { card, error: null };
    } catch {
      return { card: null, error: "Network error loading card" };
    } finally {
      cardInflight.delete(key);
    }
  })();

  cardInflight.set(key, promise);
  return promise;
}

export type ScryfallRuling = {
  object: "ruling";
  oracle_id?: string;
  source?: string;
  published_at?: string;
  comment: string;
};

const rulingsCache = new Map<string, ScryfallRuling[]>();
const rulingsInflight = new Map<
  string,
  Promise<{ rulings: ScryfallRuling[]; error: string | null }>
>();

export async function fetchRulings(
  scryfallId: string,
  oracleId?: string
): Promise<{ rulings: ScryfallRuling[]; error: string | null }> {
  const key = normId(oracleId || scryfallId);
  if (!key) return { rulings: [], error: "Missing card id" };
  const cached = rulingsCache.get(key);
  if (cached) return { rulings: cached, error: null };
  const pending = rulingsInflight.get(key);
  if (pending) return pending;

  const promise = (async () => {
    try {
      const q = oracleId ? `?oracle=${encodeURIComponent(oracleId)}` : "";
      const res = await fetch(
        `${BASE}/api/scryfall/rulings/${encodeURIComponent(scryfallId)}${q}`
      );
      const data = await res.json();
      if (!res.ok) {
        return {
          rulings: [] as ScryfallRuling[],
          error: data?.details ?? data?.error ?? "Rulings failed",
        };
      }
      const list = (data?.data as ScryfallRuling[]) ?? [];
      rulingsCache.set(key, list);
      return { rulings: list, error: null };
    } catch {
      return { rulings: [], error: "Network error loading rulings" };
    } finally {
      rulingsInflight.delete(key);
    }
  })();

  rulingsInflight.set(key, promise);
  return promise;
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
    const card = data as ScryfallCard;
    if (card?.id) cardCache.set(normId(card.id), card);
    return { card, error: null };
  } catch {
    return { card: null, error: "Network error" };
  }
}

export async function fetchPrintings(
  oracleId: string
): Promise<{ cards: ScryfallCard[]; error: string | null }> {
  const key = normId(oracleId);
  const cached = printCache.get(key);
  if (cached) return { cards: cached, error: null };

  const pending = printInflight.get(key);
  if (pending) return pending;

  const promise = (async () => {
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
      const cards = (data.data as ScryfallCard[]) ?? [];
      printCache.set(key, cards);
      for (const c of cards) {
        if (c.id) cardCache.set(normId(c.id), c);
      }
      return { cards, error: null };
    } catch {
      return { cards: [], error: "Network error loading printings" };
    } finally {
      printInflight.delete(key);
    }
  })();

  printInflight.set(key, promise);
  return promise;
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
    for (const c of cards) {
      if (c.id) cardCache.set(normId(c.id), c);
    }
    const notFound = ((data.not_found as { name?: string }[]) ?? [])
      .map((n) => n.name)
      .filter((n): n is string => Boolean(n));
    return { cards, notFound, error: null };
  } catch {
    return { cards: [], notFound: names, error: "Network error" };
  }
}

/** Batch resolve names (chunks of 75) with spacing for collection rate limit. */
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
    if (i > 0) {
      // Collection endpoint is limited to 2/sec — space client batches too
      await new Promise((r) => setTimeout(r, 600));
    }
    const chunk = unique.slice(i, i + 75);
    const { cards, notFound: nf, error } = await fetchCollectionByNames(chunk);
    if (error && cards.length === 0) {
      return { byName, notFound: [...notFound, ...chunk], error };
    }
    for (const c of cards) {
      byName.set(c.name.toLowerCase(), c);
      const face0 = c.card_faces?.[0]?.name;
      if (face0) byName.set(face0.toLowerCase(), c);
    }
    notFound.push(...nf);
  }
  return { byName, notFound, error: null };
}
