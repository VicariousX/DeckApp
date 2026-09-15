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
  /** Resolve best image URL for an oracle face (0=front, 1=back). */
  resolveImageUrl: (
    oracleId: string,
    fallbackScryfallId?: string | null,
    faceIndex?: number
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
  /** Increments whenever any oracle's art preference changes. */
  artRevision: number;
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
  const [artRevision, setArtRevision] = useState(0);

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
    // Warm image cache from local user_cards only when no live pref is seeded
    const { map: localCards } = await fetchUserCardsMap(user.id);
    for (const [oid, uc] of localCards) {
      if (imageUrlCache.current.has(oid)) continue;
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
      fallbackScryfallId?: string | null,
      faceIndex = 0
    ): Promise<string | null> => {
      const oid = normId(oracleId);
      if (!oid) return null;
      const face = faceIndex > 0 ? 1 : 0;
      const cacheKey = face === 0 ? oid : `${oid}:back`;

      const cached = imageUrlCache.current.get(cacheKey);
      if (cached) return cached;

      const art = artRef.current.get(oid);

      // Custom upload wins immediately — no network
      if (face === 0 && art?.custom_front_path) {
        const url = cardArtPublicUrl(art.custom_front_path);
        if (url) {
          imageUrlCache.current.set(cacheKey, url);
          return url;
        }
      }
      if (face === 1 && art?.custom_back_path) {
        const url = cardArtPublicUrl(art.custom_back_path);
        if (url) {
          imageUrlCache.current.set(cacheKey, url);
          return url;
        }
      }

      function faceUrl(card: ScryfallCard | undefined | null): string {
        if (!card) return "";
        if (face === 1) {
          return (
            card.card_faces?.[1]?.image_uris?.normal ||
            card.card_faces?.[1]?.image_uris?.large ||
            ""
          );
        }
        return (
          card.image_uris?.normal ||
          card.card_faces?.[0]?.image_uris?.normal ||
          card.image_uris?.large ||
          ""
        );
      }

      // Preferred printing (both faces from the same printing when available)
      if (art?.preferred_scryfall_id) {
        const prefId = normId(art.preferred_scryfall_id);
        let pref = preferredRef.current.get(prefId);
        if (!pref) {
          pref = (await ensurePreferred(prefId)) ?? undefined;
        }
        const url = faceUrl(pref);
        if (url) {
          imageUrlCache.current.set(cacheKey, url);
          return url;
        }
      }

      // Fallback printing on the deck / search hit
      if (fallbackScryfallId) {
        const fid = normId(fallbackScryfallId);
        let card = preferredRef.current.get(fid);
        if (!card) {
          card = (await ensurePreferred(fid)) ?? undefined;
        }
        const url = faceUrl(card);
        if (url) {
          if (
            face === 0 &&
            !art?.preferred_scryfall_id &&
            !art?.custom_front_path
          ) {
            imageUrlCache.current.set(cacheKey, url);
          } else if (face === 1) {
            imageUrlCache.current.set(cacheKey, url);
          }
          return url;
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
      imageUrlCache.current.delete(`${oid}:back`);
      setArtRevision((n) => n + 1);

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

      // Always overwrite preferred printing so both faces refresh
      if (printing) {
        const pid = normId(printing.id);
        setPreferredPrintings((prev) => {
          const n = new Map(prev);
          n.set(pid, printing);
          return n;
        });
        preferredRef.current = new Map(preferredRef.current).set(pid, printing);
      }

      function seedFace(card: ScryfallCard | null | undefined) {
        if (!card) return;
        const front =
          card.image_uris?.normal ||
          card.card_faces?.[0]?.image_uris?.normal ||
          "";
        const back =
          card.card_faces?.[1]?.image_uris?.normal ||
          card.card_faces?.[1]?.image_uris?.large ||
          "";
        if (front) imageUrlCache.current.set(oid, front);
        if (back) imageUrlCache.current.set(`${oid}:back`, back);
      }

      // Seed image cache immediately so search / hover / modal update without reload
      if (normalizedArt?.custom_front_path) {
        const url = cardArtPublicUrl(normalizedArt.custom_front_path);
        if (url) {
          const bust = `${url}${url.includes("?") ? "&" : "?"}v=${Date.now()}`;
          imageUrlCache.current.set(oid, bust);
        }
      }
      if (normalizedArt?.custom_back_path) {
        const url = cardArtPublicUrl(normalizedArt.custom_back_path);
        if (url) {
          const bust = `${url}${url.includes("?") ? "&" : "?"}v=${Date.now()}`;
          imageUrlCache.current.set(`${oid}:back`, bust);
        }
      }
      if (!normalizedArt?.custom_front_path) {
        if (printing) {
          seedFace(printing);
        } else if (normalizedArt?.preferred_scryfall_id) {
          const prefId = normId(normalizedArt.preferred_scryfall_id);
          const pref =
            preferredRef.current.get(prefId) ||
            (printing && normId(printing.id) === prefId ? printing : undefined);
          if (pref) seedFace(pref);
          else {
            void ensurePreferred(prefId).then((card) => {
              if (card) seedFace(card);
            });
          }
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
      artRevision,
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
      artRevision,
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
