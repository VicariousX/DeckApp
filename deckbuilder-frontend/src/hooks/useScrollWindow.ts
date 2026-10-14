import { useCallback, useEffect, useMemo, useState } from "react";
import type { ScryfallCard } from "../types/scryfallCard";

type PageChunk = { page: number; cards: ScryfallCard[] };

/**
 * Sliding window of search result sets for scroll mode.
 * Keeps ~3 page-sized sets loaded. When the viewer enters a later set,
 * the oldest set is released and the next one is requested.
 */
export function useScrollWindow(
  stream: PageChunk[],
  pageSize: number,
  hasMoreApi: boolean,
  isLoading: boolean,
  goApiPage: (page: number) => void | Promise<void>,
  enabled: boolean
) {
  const [windowStart, setWindowStart] = useState(0);

  const flat = useMemo(() => {
    const ordered = [...stream].sort((a, b) => a.page - b.page);
    return ordered.flatMap((p) => p.cards);
  }, [stream]);

  const maxLoadedPage = stream.reduce((m, p) => Math.max(m, p.page), 0);
  const minLoadedPage = stream.reduce((m, p) => Math.min(m, p.page), Infinity);

  // Reset window when the underlying result set is replaced (new search).
  useEffect(() => {
    if (stream.length === 0 || stream.every((p) => p.page === 1)) {
      setWindowStart(0);
    }
  }, [stream]);

  const windowSize = Math.max(pageSize * 3, pageSize);
  const scrollCards = flat.slice(windowStart, windowStart + windowSize);

  const ensureLoaded = useCallback(
    (absoluteIndex: number) => {
      if (!enabled || isLoading) return;
      // Prefetch next API page once the viewer is within one set of the end of what we have.
      if (absoluteIndex + pageSize >= flat.length && hasMoreApi) {
        void goApiPage(maxLoadedPage + 1);
      }
      // Prefetch previous API page if we need cards before the current stream.
      if (absoluteIndex < pageSize && minLoadedPage > 1 && minLoadedPage !== Infinity) {
        void goApiPage(minLoadedPage - 1);
      }
    },
    [enabled, isLoading, pageSize, flat.length, hasMoreApi, goApiPage, maxLoadedPage, minLoadedPage]
  );

  const onPreviewIndex = useCallback(
    (relativeIndex: number) => {
      if (!enabled) return;
      const abs = windowStart + relativeIndex;
      ensureLoaded(abs);

      // Keep the current set, one before it, and one after it in the window.
      const set = Math.floor(abs / pageSize);
      const desired = Math.max(0, (set - 1) * pageSize);
      if (desired !== windowStart) {
        setWindowStart(desired);
      }
    },
    [enabled, windowStart, pageSize, ensureLoaded]
  );

  // When new cards arrive at the front (previous API page), shift the window
  // so the previously viewed cards stay in the same absolute place.
  const [prevFlatLen, setPrevFlatLen] = useState(flat.length);
  const [prevMinPage, setPrevMinPage] = useState(minLoadedPage);
  useEffect(() => {
    if (flat.length > prevFlatLen && minLoadedPage < prevMinPage) {
      const added = flat.length - prevFlatLen;
      setWindowStart((s) => s + added);
    }
    setPrevFlatLen(flat.length);
    setPrevMinPage(minLoadedPage);
  }, [flat.length, minLoadedPage, prevFlatLen, prevMinPage]);

  return {
    scrollCards,
    windowStart,
    flatLength: flat.length,
    onPreviewIndex,
  };
}
