import { useEffect, useMemo, useState } from "react";
import { useScryfallSearch } from "./useScryfallSearch";
import { useScrollWindow } from "./useScrollWindow";
import { extractMechanicTerms } from "../lib/mechanics/search";
import { oracleIdsForMechanic } from "../services/mechanicMarkService";
import { fetchCardsByOracleIds } from "../lib/scryfallApi";
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
  const [mechLoading, setMechLoading] = useState(false);
  const [mechError, setMechError] = useState<string | null>(null);
  const [stream, setStream] = useState<PageChunk[]>([]);

  const { cards, total, hasMoreApi, apiPage, isLoading, isError, errorMessage, run, goApiPage } =
    useScryfallSearch();

  useEffect(() => {
    setStream([]);
    setMechCards([]);
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
        if (scryfallQ) {
          setMechCards([]);
          setMechLoading(false);
          return;
        }
        const { cards: found, error } = ids.length
          ? await fetchCardsByOracleIds(ids)
          : { cards: [], error: null };
        if (cancel) return;
        if (error) throw new Error(error);
        setMechCards(found);
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

  useEffect(() => {
    if (!mechParsed.terms.length || !scryfallQ || !mechIds) return;
    const flat = stream.flatMap((page) => page.cards);
    const matched = flat.filter(
      (card) => card.oracle_id && mechIds.has(card.oracle_id.toLowerCase())
    );
    setMechCards(matched);
    const loaded = stream.length;
    if (matched.length === 0 && hasMoreApi && !isLoading && !isError && loaded > 0 && loaded < 6) {
      void goApiPage((stream.at(-1)?.page ?? 1) + 1);
    }
  }, [
    stream,
    mechIds,
    scryfallQ,
    mechParsed.terms.length,
    hasMoreApi,
    isLoading,
    isError,
    goApiPage,
  ]);

  const { scrollCards } = useScrollWindow(stream);

  /** Index of the first card of the current catalog page inside the scroll list. */
  function scrollStartIndexFor(visible: ScryfallCard[]): number {
    if (!scrollCards.length || !visible.length) return 0;
    const firstId = visible[0].id;
    const idx = scrollCards.findIndex((c) => c.id === firstId);
    return idx >= 0 ? idx : 0;
  }

  const mechanicOnly = mechParsed.terms.length > 0 && !scryfallQ;

  return {
    scryfallQ,
    mechParsed,
    mechanicOnly,
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
