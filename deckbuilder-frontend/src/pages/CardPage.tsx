import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CardArtPanel } from "../components/CardArtPanel";
import { CardDetail } from "../components/CardDetail";
import { CardImage } from "../components/CardImage";
import { CardNameSwitcher } from "../components/CardNameSwitcher";
import { fetchCardById } from "../lib/scryfallApi";
import { mapScryfallToDeckApp } from "../lib/cards/mapScryfallToDeckApp";
import type { DeckAppCard } from "../types/deckAppCard";
import type { ScryfallCard } from "../types/scryfallCard";
import transitions from "../styles/pageTransitions.module.css";
import styles from "./CardPage.module.css";

export function CardPage() {
  const { id } = useParams<{ id: string }>();
  const [card, setCard] = useState<ScryfallCard | null>(null);
  const [resolved, setResolved] = useState<DeckAppCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      setCard(null);
      setResolved(null);
      const { card: c, error: err } = await fetchCardById(id!);
      if (cancelled) return;
      if (err || !c) {
        setError(err ?? "Card not found");
        setLoading(false);
        return;
      }
      setCard(c);
      setResolved(
        mapScryfallToDeckApp(c)
      );
      setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const onResolvedChange = useCallback((next: DeckAppCard) => {
    setResolved(next);
  }, []);

  // Display card: if preferred printing differs and we only have base scryfall,
  // still show CardImage from base but overlay resolved image URLs via a synthetic card.
  const displayCard = card
    ? withResolvedImages(card, resolved)
    : null;

  return (
    <div className={`${transitions.page} ${styles.page}`}>
      <div className={styles.topBar}>
        <Link to="/search" className={styles.backLink}>
          ← Search
        </Link>
        {card && <CardNameSwitcher currentName={card.name} />}
      </div>

      {loading && <p className={styles.status}>Loading card…</p>}
      {error && <p className={styles.statusError}>{error}</p>}

      {!loading && card && displayCard && (
        <div className={styles.layout}>
          <div className={styles.visual}>
            <div className={styles.imageFrame}>
              <CardImage card={displayCard} />
            </div>
            {resolved && (resolved.has_custom_art || resolved.has_preferred_printing) && (
              <p className={styles.badgeRow}>
                {resolved.has_custom_art && (
                  <span className={styles.badge}>Custom art</span>
                )}
                {resolved.has_preferred_printing && (
                  <span className={styles.badge}>Preferred printing</span>
                )}
              </p>
            )}
          </div>

          <div className={styles.info}>
            <CardDetail card={displayCard} />
          </div>

          <div className={styles.artCol}>
            <CardArtPanel card={card} onResolvedChange={onResolvedChange} />
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Build a ScryfallCard-shaped object whose image_uris / face image_uris
 * point at the resolved DeckApp URLs so existing CardImage/CardDetail work.
 */
function withResolvedImages(
  base: ScryfallCard,
  resolved: DeckAppCard | null
): ScryfallCard {
  if (!resolved) return base;

  // If a preferred printing was applied, identity fields may differ — keep text from resolved mapping
  const frontUrl = resolved.faces[0]?.image_url;
  const backUrl = resolved.faces[1]?.image_url;

  if (resolved.has_custom_art || resolved.has_preferred_printing) {
    const next: ScryfallCard = {
      ...base,
      id: resolved.scryfall_id || base.id,
      oracle_id: resolved.oracle_id || base.oracle_id,
      name: resolved.name,
      type_line: resolved.type_line,
      set: resolved.set,
      set_name: resolved.set_name,
      rarity: resolved.rarity,
      collector_number: resolved.collector_number,
      artist: resolved.artist,
    };

    if (base.card_faces && base.card_faces.length > 1) {
      next.card_faces = base.card_faces.map((face, i) => ({
        ...face,
        name: resolved.faces[i]?.name ?? face.name,
        image_uris: resolved.faces[i]?.image_url
          ? {
              normal: resolved.faces[i].image_url,
              large: resolved.faces[i].image_url,
              small: resolved.faces[i].image_url,
            }
          : face.image_uris,
      }));
      next.image_uris = null;
    } else {
      next.image_uris = frontUrl
        ? {
            normal: frontUrl,
            large: frontUrl,
            small: frontUrl,
          }
        : base.image_uris;
      // Optional synthetic back from custom upload on single-faced card
      if (backUrl && resolved.faces.length > 1) {
        next.card_faces = [
          {
            name: resolved.faces[0]?.name ?? base.name,
            type_line: resolved.faces[0]?.type_line ?? base.type_line,
            mana_cost: resolved.faces[0]?.mana_cost ?? base.mana_cost,
            oracle_text: resolved.faces[0]?.oracle_text ?? base.oracle_text,
            artist: resolved.faces[0]?.artist,
            image_uris: {
              normal: frontUrl,
              large: frontUrl,
              small: frontUrl,
            },
          },
          {
            name: resolved.faces[1]?.name ?? "Custom back",
            type_line: resolved.faces[1]?.type_line ?? base.type_line,
            image_uris: {
              normal: backUrl,
              large: backUrl,
              small: backUrl,
            },
          },
        ];
        next.image_uris = null;
      }
    }
    return next;
  }

  return base;
}
