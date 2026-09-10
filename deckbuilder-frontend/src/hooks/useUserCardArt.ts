import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import {
  fetchUserCardArtMap,
  getCardArtPublicBase,
} from "../services/cardArtService";
import type { UserCardArt } from "../types/deckAppCard";
import type { ScryfallCard } from "../types/scryfallCard";
import {
  mapScryfallListWithArt,
  type ResolveArtOptions,
} from "../lib/cards/mapScryfallToDeckApp";
import type { DeckAppCard } from "../types/deckAppCard";

/**
 * Loads the signed-in user's card-art preferences and exposes helpers
 * to resolve Scryfall search hits into DeckAppCard with overrides applied.
 */
export function useUserCardArt() {
  const { user } = useAuth();
  const [artByOracleId, setArtByOracleId] = useState<
    Map<string, UserCardArt>
  >(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!user) {
      setArtByOracleId(new Map());
      setError(null);
      return;
    }
    setLoading(true);
    const { map, error: err } = await fetchUserCardArtMap(user.id);
    setArtByOracleId(map);
    setError(err);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const resolveOptions = useCallback((): ResolveArtOptions => {
    return {
      publicStorageBase: getCardArtPublicBase(),
      // Preferred-printing payloads can be filled later when we fetch by id
      preferredPrintings: undefined,
    };
  }, []);

  const resolveCards = useCallback(
    (scryfallCards: ScryfallCard[]): DeckAppCard[] => {
      return mapScryfallListWithArt(
        scryfallCards,
        artByOracleId,
        resolveOptions()
      );
    },
    [artByOracleId, resolveOptions]
  );

  return {
    artByOracleId,
    loading,
    error,
    reload,
    resolveCards,
    isLoggedIn: Boolean(user),
  };
}
