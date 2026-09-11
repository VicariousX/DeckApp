import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "./AuthProvider";
import {
  cardArtPublicUrl,
  fetchUserCardArtMap,
  getCardArtPublicBase,
} from "../services/cardArtService";
import { fetchUserCardsMap } from "../services/userCardService";
import { fetchCardById } from "../lib/scryfallApi";
import {
  applyUserCardArt,
  mapScryfallToDeckApp,
} from "../lib/cards/mapScryfallToDeckApp";
import { withResolvedImages } from "../lib/cards/withResolvedImages";
import type { DeckAppCard, UserCardArt } from "../types/deckAppCard";
import type { ScryfallCard } from "../types/scryfallCard";

function normId(id: string | null | undefined): string {
  return (id ?? "").toLowerCase();
}

type ArtPreferencesContextValue = {
  artByOracleId: Map<string, UserCardArt>;
  preferredPrintings: Map<string, ScryfallCard>;
  loading: boolean;
  reload: () => Promise<void>;
  /** Resolve best front image URL for an oracle + optional fallback scryfall id. */
  resolveImageUrl: (
    oracleId: string,
    fallbackScryfallId?: string | null
  ) => Promise<string | null>;
  /** Apply user art to a Scryfall card (sync if preferred already cached). */
  resolveDisplayCard: (card: ScryfallCard) => {
    display: ScryfallCard;
    resolved: DeckAppCard;
  };
  /** True when user has custom upload or a non-default preferred printing. */
  hasAlternateArt: (oracleId: string, currentScryfallId?: string) => boolean;
  /**
   * Immediately patch in-memory prefs after the user changes art.
   * Invalidates image cache for that oracle and prefetches preferred printing.
   * Pass `printing` when selecting a preferred Scryfall printing so images
   * update without waiting for a network reload.
   */
  applyArtPreference: (
    oracleId: string,
    art: UserCardArt | null,
    printing?: ScryfallCard | null
  ) => void;
  isLoggedIn: boolean;
};

const ArtPreferencesContext =
  createContext<ArtPreferencesContextValue | null>(null);

export function ArtPreferencesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [artByOracleId, setArtByOracleId] = useState<Map<string, UserCardArt>>(
    () => new Map()
  );
  const [preferredPrintings, setPreferredPrintings] = useState<
    Map<string, ScryfallCard>
  >(() => new Map());
  const [loading, setLoading] = useState(false);

  // Persistent image URL cache: oracle_id → resolved front URL
  const imageUrlCache = useRef<Map<string, string>>(new Map());
  const inflightPreferred = useRef<Map<string, Promise<ScryfallCard | null>>>(
    new Map()
  );
  const preferredRef = useRef(preferredPrintings);
  preferredRef.current = preferredPrintings;
  const artRef = useRef(artByOracleId);
  artRef.current = artByOracleId;

  const reload = useCallback(async () => {
    if (!user) {
      setArtByOracleId(new Map());
      setPreferredPrintings(new Map());
      imageUrlCache.current.clear();
      return;
    }
    setLoading(true);
    const { map } = await fetchUserCardArtMap(user.id);
    // Normalize keys
    const normalized = new Map<string, UserCardArt>();
    for (const [k, v] of map) {
      normalized.set(normId(k), {
        ...v,
        oracle_id: normId(v.oracle_id),
        preferred_scryfall_id: v.preferred_scryfall_id
          ? normId(v.preferred_scryfall_id)
          : null,
      });
    }
    setArtByOracleId(normalized);
    // Warm image cache from local user_cards without wiping freshly seeded entries
    const { map: localCards } = await fetchUserCardsMap(user.id);
    for (const [oid, uc] of localCards) {
      if (uc.image_url) imageUrlCache.current.set(oid, uc.image_url);
    }
    // Drop cache entries for oracles no longer in prefs and not in user_cards
    for (const key of [...imageUrlCache.current.keys()]) {
      if (!normalized.has(key) && !localCards.has(key)) {
        imageUrlCache.current.delete(key);
      }
    }
    setLoading(false);

    // Prefetch preferred printings in background
    const ids = new Set<string>();
    for (const art of normalized.values()) {
      if (art.preferred_scryfall_id) {
        ids.add(normId(art.preferred_scryfall_id));
      }
    }
    if (ids.size === 0) return;

    const next = new Map(preferredRef.current);
    await Promise.all(
      [...ids].map(async (id) => {
        if (next.has(id)) return;
        const { card } = await fetchCardById(id);
        if (card) next.set(id, card);
      })
    );
    setPreferredPrintings(next);
  }, [user]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const ensurePreferred = useCallback(
    async (scryfallId: string): Promise<ScryfallCard | null> => {
      const id = normId(scryfallId);
      if (!id) return null;
      const existing = preferredRef.current.get(id);
      if (existing) return existing;
      let p = inflightPreferred.current.get(id);
      if (!p) {
        p = fetchCardById(id).then(({ card }) => {
          if (card) {
            setPreferredPrintings((prev) => {
              if (prev.has(id)) return prev;
              const n = new Map(prev);
              n.set(id, card);
              return n;
            });
          }
          inflightPreferred.current.delete(id);
          return card;
        });
        inflightPreferred.current.set(id, p);
      }
      return p;
    },
    []
  );

  const resolveImageUrl = useCallback(
    async (
      oracleId: string,
      fallbackScryfallId?: string | null
    ): Promise<string | null> => {
      const oid = normId(oracleId);
      if (!oid) return null;

      const cached = imageUrlCache.current.get(oid);
      if (cached) return cached;

      const art = artRef.current.get(oid);

      // Custom upload wins immediately — no network
      if (art?.custom_front_path) {
        const url = cardArtPublicUrl(art.custom_front_path);
        if (url) {
          imageUrlCache.current.set(oid, url);
          return url;
        }
      }

      // Preferred printing
      if (art?.preferred_scryfall_id) {
        const prefId = normId(art.preferred_scryfall_id);
        let pref = preferredRef.current.get(prefId);
        if (!pref) {
          pref = (await ensurePreferred(prefId)) ?? undefined;
        }
        if (pref) {
          const url =
            pref.image_uris?.normal ||
            pref.card_faces?.[0]?.image_uris?.normal ||
            "";
          if (url) {
            imageUrlCache.current.set(oid, url);
            return url;
          }
        }
      }

      // Fallback printing on the deck / search hit
      if (fallbackScryfallId) {
        const fid = normId(fallbackScryfallId);
        let card = preferredRef.current.get(fid);
        if (!card) {
          card = (await ensurePreferred(fid)) ?? undefined;
        }
        if (card) {
          const url =
            card.image_uris?.normal ||
            card.card_faces?.[0]?.image_uris?.normal ||
            "";
          if (url) {
            // Only cache under oracle if no custom/preferred preference
            if (!art?.preferred_scryfall_id && !art?.custom_front_path) {
              imageUrlCache.current.set(oid, url);
            }
            return url;
          }
        }
      }

      return null;
    },
    [ensurePreferred]
  );

  const resolveDisplayCard = useCallback(
    (card: ScryfallCard) => {
      const base = mapScryfallToDeckApp(card);
      const art = artByOracleId.get(normId(base.oracle_id));
      const resolved = applyUserCardArt(base, art, {
        publicStorageBase: getCardArtPublicBase(),
        preferredPrintings,
      });
      const display = withResolvedImages(card, resolved);
      return { display, resolved };
    },
    [artByOracleId, preferredPrintings]
  );

  const applyArtPreference = useCallback(
    (
      oracleId: string,
      art: UserCardArt | null,
      printing?: ScryfallCard | null
    ) => {
      const oid = normId(oracleId);
      if (!oid) return;
      imageUrlCache.current.delete(oid);

      // Normalize art IDs so map lookups always hit
      const normalizedArt = art
        ? {
            ...art,
            oracle_id: oid,
            preferred_scryfall_id: art.preferred_scryfall_id
              ? normId(art.preferred_scryfall_id)
              : null,
          }
        : null;

      setArtByOracleId((prev) => {
        const next = new Map(prev);
        if (!normalizedArt) {
          next.delete(oid);
        } else {
          next.set(oid, normalizedArt);
        }
        return next;
      });

      // Seed preferredPrintings from the printing the user just picked
      if (printing) {
        const pid = normId(printing.id);
        setPreferredPrintings((prev) => {
          if (prev.has(pid)) return prev;
          const n = new Map(prev);
          n.set(pid, printing);
          return n;
        });
        preferredRef.current = new Map(preferredRef.current).set(pid, printing);
      }

      // Seed image cache immediately so search / hover / modal update without reload
      if (normalizedArt?.custom_front_path) {
        const url = cardArtPublicUrl(normalizedArt.custom_front_path);
        if (url) imageUrlCache.current.set(oid, url);
      } else if (printing) {
        const url =
          printing.image_uris?.normal ||
          printing.card_faces?.[0]?.image_uris?.normal ||
          "";
        if (url) imageUrlCache.current.set(oid, url);
      } else if (normalizedArt?.preferred_scryfall_id) {
        const prefId = normId(normalizedArt.preferred_scryfall_id);
        const pref =
          preferredRef.current.get(prefId) ||
          (printing && normId(printing.id) === prefId ? printing : undefined);
        if (pref) {
          const url =
            pref.image_uris?.normal ||
            pref.card_faces?.[0]?.image_uris?.normal ||
            "";
          if (url) imageUrlCache.current.set(oid, url);
        } else {
          void ensurePreferred(prefId).then((card) => {
            if (!card) return;
            const url =
              card.image_uris?.normal ||
              card.card_faces?.[0]?.image_uris?.normal ||
              "";
            if (url) imageUrlCache.current.set(oid, url);
          });
        }
      }
    },
    [ensurePreferred]
  );

  const hasAlternateArt = useCallback(
    (oracleId: string, currentScryfallId?: string) => {
      const art = artByOracleId.get(normId(oracleId));
      if (!art) return false;
      if (art.custom_front_path || art.custom_back_path) return true;
      if (
        art.preferred_scryfall_id &&
        currentScryfallId &&
        normId(art.preferred_scryfall_id) !== normId(currentScryfallId)
      ) {
        return true;
      }
      if (art.preferred_scryfall_id && !currentScryfallId) return true;
      return false;
    },
    [artByOracleId]
  );

  const value = useMemo<ArtPreferencesContextValue>(
    () => ({
      artByOracleId,
      preferredPrintings,
      loading,
      reload,
      resolveImageUrl,
      resolveDisplayCard,
      hasAlternateArt,
      applyArtPreference,
      isLoggedIn: Boolean(user),
    }),
    [
      artByOracleId,
      preferredPrintings,
      loading,
      reload,
      resolveImageUrl,
      resolveDisplayCard,
      hasAlternateArt,
      applyArtPreference,
      user,
    ]
  );

  return (
    <ArtPreferencesContext.Provider value={value}>
      {children}
    </ArtPreferencesContext.Provider>
  );
}

export function useArtPreferences() {
  const ctx = useContext(ArtPreferencesContext);
  if (!ctx) {
    throw new Error(
      "useArtPreferences must be used within ArtPreferencesProvider"
    );
  }
  return ctx;
}
