import { useMemo } from "react";
import type { ScryfallCard } from "../types/scryfallCard";

type PageChunk = { page: number; cards: ScryfallCard[] };

/**
 * Flat list of every loaded search page, in page order.
 * Scroll mode passes this whole list so the viewer can move continuously.
 * More pages are requested only when the user actually reaches an end.
 */
export function useScrollWindow(stream: PageChunk[]) {
  const scrollCards = useMemo(() => {
    const ordered = [...stream].sort((a, b) => a.page - b.page);
    return ordered.flatMap((p) => p.cards);
  }, [stream]);

  return { scrollCards };
}
