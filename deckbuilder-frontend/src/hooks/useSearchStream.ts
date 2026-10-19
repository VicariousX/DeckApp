import { useEffect, useMemo, useState } from "react";
import { useScryfallSearch } from "./useScryfallSearch";
import { useScrollWindow } from "./useScrollWindow";
import { extractMechanicTerms } from "../lib/mechanics/search";
import { oracleIdsForMechanic } from "../services/mechanicMarkService";
import { fetchCollectionByIds } from "../lib/scryfallApi";
import type { ScryfallCard } from "../types/scryfallCard";

type PageChunk = { page: number; cards: ScryfallCard[] };

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
  const [stream, setStream] = useState<PageChunk[]>([]);

  const { cards, total, hasMoreApi, apiPage, isLoading, isError, errorMessage, run, goApiPage } =
    useScryfallSearch();

  useEffect(() => {
    setStream([]);
    if (scryfallQ) void run(scryfallQ, apiOrder, sortDir);
  }, [scryfallQ, apiOrder, sortDir, run]);

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
      return;
    }
    let cancel = false;
    void (async () => {
      const sets: string[][] = [];
      for (const t of mechParsed.terms) {
        const { ids } = await oracleIdsForMechanic(t.id, t.economy);
        sets.push(ids);
      }
      if (cancel) return;
      let acc = new Set(sets[0] ?? []);
      mechParsed.terms.forEach((t, i) => {
        const s = new Set(sets[i] ?? []);
        if (t.negate) acc = new Set([...acc].filter((id) => !s.has(id)));
        else if (i > 0) acc = new Set([...acc].filter((id) => s.has(id)));
      });
      setMechIds(acc);
      if (!scryfallQ && acc.size) {
        const { cards: found } = await fetchCollectionByIds([...acc].slice(0, 75));
        if (!cancel) setMechCards(found);
      } else setMechCards([]);
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
