import { useEffect, useRef, useState, type MouseEvent } from "react";
import { useArtPreferences } from "../auth/ArtPreferencesProvider";
import type { DeckCard } from "../types/deck";

/** Hover preview of preferred/custom art for a deck card name. */
export function useDeckCardHover() {
  const { resolveImageUrl, artByOracleId } = useArtPreferences();
  const [hoverCard, setHoverCard] = useState<DeckCard | null>(null);
  const [hoverSrc, setHoverSrc] = useState<string | null>(null);
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 });
  const hoverCache = useRef<Map<string, string>>(new Map());
  const hoverLeaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Drop local hover cache when art prefs change so preferred/custom art shows immediately
  useEffect(() => {
    hoverCache.current.clear();
    if (hoverCard) {
      const oracleId = hoverCard.oracle_id || hoverCard.scryfall_id;
      void resolveImageUrl(oracleId, hoverCard.scryfall_id).then((url) => {
        if (url) {
          hoverCache.current.set(oracleId.toLowerCase(), url);
          setHoverSrc(url);
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run when art map identity changes
  }, [artByOracleId]);

  useEffect(() => {
    if (!hoverCard) {
      setHoverSrc(null);
      return;
    }
    const oracleId = hoverCard.oracle_id || hoverCard.scryfall_id;
    const cacheKey = oracleId.toLowerCase();
    const cached = hoverCache.current.get(cacheKey);
    if (cached) {
      setHoverSrc(cached);
      return;
    }
    let cancelled = false;
    async function resolve() {
      const url = await resolveImageUrl(oracleId, hoverCard!.scryfall_id);
      if (cancelled) return;
      if (url) {
        hoverCache.current.set(cacheKey, url);
        setHoverSrc(url);
      } else {
        setHoverSrc(null);
      }
    }
    void resolve();
    return () => {
      cancelled = true;
    };
  }, [hoverCard, resolveImageUrl]);

  function warmCache(cards: DeckCard[]) {
    for (const c of cards) {
      const oid = (c.oracle_id || c.scryfall_id).toLowerCase();
      if (hoverCache.current.has(oid)) continue;
      void resolveImageUrl(c.oracle_id || c.scryfall_id, c.scryfall_id).then(
        (url) => {
          if (url) hoverCache.current.set(oid, url);
        }
      );
    }
  }

  function onNameEnter(card: DeckCard, e: MouseEvent) {
    if (hoverLeaveTimer.current) clearTimeout(hoverLeaveTimer.current);
    setHoverCard(card);
    setHoverPos({ x: e.clientX, y: e.clientY });
  }

  function onNameMove(e: MouseEvent) {
    setHoverPos({ x: e.clientX, y: e.clientY });
  }

  function onNameLeave() {
    hoverLeaveTimer.current = setTimeout(() => {
      setHoverCard(null);
      setHoverSrc(null);
    }, 80);
  }

  return {
    hoverCard,
    hoverSrc,
    hoverPos,
    onNameEnter,
    onNameMove,
    onNameLeave,
    warmCache,
  };
}
