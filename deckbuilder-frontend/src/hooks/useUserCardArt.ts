import { useCallback, useEffect, useMemo, useState } from "react";
import { useArtPreferences } from "../auth/ArtPreferencesProvider";
import { fetchCardById } from "../lib/scryfallApi";
import {
  applyUserCardArt,
  mapScryfallToDeckApp,
} from "../lib/cards/mapScryfallToDeckApp";
import { withResolvedImages } from "../lib/cards/withResolvedImages";
import { getCardArtPublicBase } from "../services/cardArtService";
import type { DeckAppCard } from "../types/deckAppCard";
import type { ScryfallCard } from "../types/scryfallCard";

export function useUserCardArt() {
  const {
    artByOracleId,
    preferredPrintings,
    loading,
    reload,
    isLoggedIn,
    resolveDisplayCard,
  } = useArtPreferences();

  const resolveCards = useCallback(
    (scryfallCards: ScryfallCard[]): DeckAppCard[] => {
      return scryfallCards.map((c) => resolveDisplayCard(c).resolved);
    },
    [resolveDisplayCard]
  );

  return {
    artByOracleId,
    preferredPrintings,
    loading,
    error: null as string | null,
    reload,
    resolveCards,
    isLoggedIn,
  };
}

export type DisplayCardPair = {
  original: ScryfallCard;
  display: ScryfallCard;
  resolved: DeckAppCard;
};

export function useDisplayCards(cards: ScryfallCard[]): {
  pairs: DisplayCardPair[];
  loading: boolean;
  artLoading: boolean;
} {
  const {
    artByOracleId,
    preferredPrintings,
    loading: artLoading,
    isLoggedIn,
  } = useArtPreferences();
  const [extraPrintings, setExtraPrintings] = useState<
    Map<string, ScryfallCard>
  >(new Map());
  const [prefsLoading, setPrefsLoading] = useState(false);

  useEffect(() => {
    if (!isLoggedIn || cards.length === 0 || artByOracleId.size === 0) {
      setExtraPrintings(new Map());
      return;
    }
    const needed = new Set<string>();
    for (const card of cards) {
      const oracleId = (card.oracle_id ?? card.id).toLowerCase();
      const art = artByOracleId.get(oracleId);
      if (
        art?.preferred_scryfall_id &&
        art.preferred_scryfall_id.toLowerCase() !== card.id.toLowerCase() &&
        !preferredPrintings.has(art.preferred_scryfall_id.toLowerCase())
      ) {
        needed.add(art.preferred_scryfall_id.toLowerCase());
      }
    }
    if (needed.size === 0) {
      setExtraPrintings(new Map());
      return;
    }
    let cancelled = false;
    async function load() {
      setPrefsLoading(true);
      const map = new Map<string, ScryfallCard>();
      await Promise.all(
        [...needed].map(async (id) => {
          const { card } = await fetchCardById(id);
          if (card) map.set(id, card);
        })
      );
      if (!cancelled) {
        setExtraPrintings(map);
        setPrefsLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [cards, artByOracleId, preferredPrintings, isLoggedIn]);

  const pairs = useMemo(() => {
    const merged = new Map(preferredPrintings);
    for (const [k, v] of extraPrintings) merged.set(k, v);
    const publicBase = getCardArtPublicBase();
    return cards.map((original) => {
      const base = mapScryfallToDeckApp(original);
      const art = artByOracleId.get(base.oracle_id.toLowerCase());
      const resolved = applyUserCardArt(base, art, {
        publicStorageBase: publicBase,
        preferredPrintings: merged,
      });
      const display = withResolvedImages(original, resolved);
      return { original, display, resolved };
    });
  }, [cards, artByOracleId, preferredPrintings, extraPrintings]);

  return {
    pairs,
    loading: artLoading || prefsLoading,
    artLoading,
  };
}
