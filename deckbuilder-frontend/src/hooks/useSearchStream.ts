import { useEffect, useMemo, useState } from "react";
import { useScryfallSearch } from "./useScryfallSearch";
import { useScrollWindow } from "./useScrollWindow";
import { extractMechanicTerms } from "../lib/mechanics/search";
import { oracleIdsForMechanic } from "../services/mechanicMarkService";
import { fetchCardsByOracleIds } from "../lib/scryfallApi";
import { compileQuery } from "../lib/search/localQuery";
import { fetchProxiedScryfall } from "../lib/scryfallProxy";
import type { ScryfallCard } from "../types/scryfallCard";

type PageChunk = { page: number; cards: ScryfallCard[] };

/** One live search, then keep only marked cards. Used when the query is not local. */
async function pageAndIntersect(
  q: string,
  allowed: Set<string>,
  cancelled: () => boolean
): Promise<ScryfallCard[]> {
  const found: ScryfallCard[] = [];
  const seen = new Set<string>();
  for (let page = 1; page <= 8; page += 1) {
    if (cancelled()) return found;
    const response = await fetchProxiedScryfall(
      `/api/scryfall?${new URLSearchParams({ q, page: String(page) }).toString()}`
    );
    if (response.status === 404) return found;
    if (!response.ok) throw new Error("Could not apply the other search filters.");
    const json = (await response.json()) as { data?: ScryfallCard[]; has_more?: boolean };
    for (const card of json.data ?? []) {
      const key = card.oracle_id?.toLowerCase();
      if (!key || !allowed.has(key) || seen.has(key)) continue;
      seen.add(key);
      found.push(card);
    }
    if (!json.has_more) break;
  }
  return found;
}

/**
 * Owns the accumulated Scryfall page stream, mechanic filtering, and the
 * flat scroll list. SearchResultsPage and SearchResultsPanel both consume
 * this so page-loading and start-index logic live in one place.
 */
export function useSearchStream(query: string, apiOrder: string, sortDir: "asc" | "desc") {
  const mechParsed = useMemo(() => extractMechanicTerms(query), [query]);
  const scryfallQ = mechParsed.rest || (mechParsed.terms.length ? "" : query);
  const [mechCards, setMechCards] = useState<ScryfallCard[]>([]);
  const [mechIds, setMechIds] = useState<Set<string> | null>(null);
  const [mechLoading, setMechLoading] = useState(false);
  const [mechError, setMechError] = useState<string | null>(null);
  const [stream, setStream] = useState<PageChunk[]>([]);

  const { cards, total, hasMoreApi, apiPage, isLoading, isError, errorMessage, run, goApiPage } =
    useScryfallSearch();

  useEffect(() => {
    setStream([]);
    setMechCards([]);
    if (scryfallQ && mechParsed.terms.length === 0) void run(scryfallQ, apiOrder, sortDir);
  }, [scryfallQ, apiOrder, sortDir, run, mechParsed.terms.length]);

  useEffect(() => {
    if (!cards.length) return;
    setStream((prev) => {
      const next = prev.filter((p) => p.page !== apiPage);
      next.push({ page: apiPage, cards });
      next.sort((a, b) => a.page - b.page);
      return next;
    });
  }, [cards, apiPage]);

  useEffect(() => {
    if (!mechParsed.terms.length) {
      setMechIds(null);
      setMechCards([]);
      setMechLoading(false);
      setMechError(null);
      return;
    }
    let cancel = false;
    setMechLoading(true);
    setMechError(null);
    void (async () => {
      try {
        const sets: string[][] = [];
        for (const t of mechParsed.terms) {
          const { ids, error } = await oracleIdsForMechanic(t.id, t.relation);
          if (error) throw new Error(error);
          sets.push(ids);
        }
        if (cancel) return;
        let acc = new Set(sets[0] ?? []);
        mechParsed.terms.forEach((t, i) => {
          const s = new Set(sets[i] ?? []);
          if (t.negate) acc = new Set([...acc].filter((id) => !s.has(id)));
          else if (i > 0) acc = new Set([...acc].filter((id) => s.has(id)));
        });
        let ids = [...acc];
        if (cancel) return;
        const idSet = new Set(ids);
        setMechIds(idSet);
        const { cards: found, error } = ids.length
          ? await fetchCardsByOracleIds(ids)
          : { cards: [], error: null };
        if (cancel) return;
        if (error) throw new Error(error);
        if (!scryfallQ) {
          setMechCards(found);
          return;
        }
        const match = compileQuery(scryfallQ);
        if (match) {
          setMechCards(found.filter(match));
          return;
        }
        setMechCards(await pageAndIntersect(scryfallQ, idSet, () => cancel));
      } catch (err) {
        if (cancel) return;
        setMechIds(new Set());
        setMechCards([]);
        setMechError(err instanceof Error ? err.message : "Mechanic search failed");
      } finally {
        if (!cancel) setMechLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [mechParsed, scryfallQ]);

  const { scrollCards } = useScrollWindow(stream);

  /** Index of the first card of the current catalog page inside the scroll list. */
  function scrollStartIndexFor(visible: ScryfallCard[]): number {
    if (!scrollCards.length || !visible.length) return 0;
    const firstId = visible[0].id;
    const idx = scrollCards.findIndex((c) => c.id === firstId);
    return idx >= 0 ? idx : 0;
  }

  return {
    scryfallQ,
    mechParsed,
    mechCards,
    mechIds,
    mechLoading,
    mechError,
    stream,
    cards,
    total,
    hasMoreApi,
    apiPage,
    isLoading,
    isError,
    errorMessage,
    run,
    goApiPage,
    scrollCards,
    scrollStartIndexFor,
  };
}
