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
