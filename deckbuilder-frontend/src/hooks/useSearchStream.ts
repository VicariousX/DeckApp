import { useEffect, useMemo, useState } from "react";
import { useScryfallSearch } from "./useScryfallSearch";
import { useScrollWindow } from "./useScrollWindow";
import { extractMechanicTerms } from "../lib/mechanics/search";
import { oracleIdsForMechanic } from "../services/mechanicMarkService";
import { fetchCardsByOracleIds } from "../lib/scryfallApi";
import { fetchProxiedScryfall } from "../lib/scryfallProxy";
import type { ScryfallCard } from "../types/scryfallCard";

type PageChunk = { page: number; cards: ScryfallCard[] };

/** Cards in the mark set that also satisfy the Scryfall query. */
const ORACLE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function searchOracleChunk(
  ids: string[],
  q: string,
  found: ScryfallCard[],
  seen: Set<string>,
  allowed: Set<string>,
  onBatch: (cards: ScryfallCard[]) => void,
  cancelled: () => boolean
): Promise<void> {
  if (!ids.length || cancelled()) return;
  const query = `(${ids.map((id) => `oracleid:${id}`).join(" OR ")}) ${q}`;
  let page = 1;
  for (;;) {
    if (cancelled()) return;
    const response = await fetchProxiedScryfall(
      `/api/scryfall?${new URLSearchParams({ q: query, page: String(page) }).toString()}`
    );
    if (response.status === 404) return;
    if (response.status === 400 && ids.length > 1) {
      const mid = Math.ceil(ids.length / 2);
      await searchOracleChunk(ids.slice(0, mid), q, found, seen, allowed, onBatch, cancelled);
      await searchOracleChunk(ids.slice(mid), q, found, seen, allowed, onBatch, cancelled);
      return;
    }
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      let message = "Could not apply the other search filters.";
      try {
        const parsed = JSON.parse(detail) as { details?: string; error?: string };
        if (parsed.details || parsed.error) message = parsed.details || parsed.error || message;
      } catch {
        if (detail.trim()) message = detail.replace(/\s+/g, " ").slice(0, 180);
      }
      throw new Error(message);
    }
    const json = (await response.json()) as { data?: ScryfallCard[]; has_more?: boolean };
    let added = false;
    for (const card of json.data ?? []) {
      const key = (card.oracle_id || "").toLowerCase();
      if (!key || seen.has(key) || !allowed.has(key)) continue;
      seen.add(key);
      found.push(card);
      added = true;
    }
    if (added) onBatch([...found]);
    if (!json.has_more || page >= 4) return;
    page += 1;
  }
}

async function cardsMatchingQuery(
  oracleIds: string[],
  q: string,
  onBatch: (cards: ScryfallCard[]) => void,
  cancelled: () => boolean
): Promise<void> {
  const pending = oracleIds.filter((id) => ORACLE_ID.test(id));
  const allowed = new Set(pending);
  const seen = new Set<string>();
  const found: ScryfallCard[] = [];
  while (pending.length) {
    if (cancelled()) return;
    const chunk: string[] = [];
    while (pending.length) {
      const next = [...chunk, pending[0]];
      const query = `(${next.map((id) => `oracleid:${id}`).join(" OR ")}) ${q}`;
      if (chunk.length && query.length > 980) break;
      chunk.push(pending.shift()!);
    }
    await searchOracleChunk(chunk, q, found, seen, allowed, onBatch, cancelled);
  }
  onBatch([...found]);
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
        if (!scryfallQ) {
          const { cards: found, error } = ids.length
            ? await fetchCardsByOracleIds(ids)
            : { cards: [], error: null };
          if (cancel) return;
          if (error) throw new Error(error);
          setMechCards(found);
          return;
        }
        const allowed = new Set(ids);
        await cardsMatchingQuery(
          ids,
          scryfallQ,
          (batch) => {
            if (!cancel) setMechCards(batch.filter((card) => card.oracle_id && allowed.has(card.oracle_id.toLowerCase())));
          },
          () => cancel
        );
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
