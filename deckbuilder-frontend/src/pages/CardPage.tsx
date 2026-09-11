import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { CardArtPanel } from "../components/CardArtPanel";
import { CardDetail } from "../components/CardDetail";
import { CardImage } from "../components/CardImage";
import { CardLightbox } from "../components/CardLightbox";
import { CardNameSwitcher } from "../components/CardNameSwitcher";
import { fetchCardById } from "../lib/scryfallApi";
import { mapScryfallToDeckApp } from "../lib/cards/mapScryfallToDeckApp";
import { withResolvedImages } from "../lib/cards/withResolvedImages";
import { useArtPreferences } from "../auth/ArtPreferencesProvider";
import { getFaceImage } from "../utils/scryfall";
import type { DeckAppCard } from "../types/deckAppCard";
import type { ScryfallCard } from "../types/scryfallCard";
import transitions from "../styles/pageTransitions.module.css";
import styles from "./CardPage.module.css";

export function CardPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { reload: reloadArtPrefs } = useArtPreferences();
  const [card, setCard] = useState<ScryfallCard | null>(null);
  const [resolved, setResolved] = useState<DeckAppCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      setCard(null);
      setResolved(null);
      setLightboxSrc(null);
      const { card: c, error: err } = await fetchCardById(id!);
      if (cancelled) return;
      if (err || !c) {
        setError(err ?? "Card not found");
        setLoading(false);
        return;
      }
      setCard(c);
      setResolved(mapScryfallToDeckApp(c));
      setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const onResolvedChange = useCallback(
    (next: DeckAppCard) => {
      setResolved(next);
      void reloadArtPrefs();
    },
    [reloadArtPrefs]
  );

  function goBack() {
    // Prefer real browser history when the user navigated within the app
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate("/search");
  }

  const displayCard = card ? withResolvedImages(card, resolved) : null;
  const enlargeSrc = displayCard ? getFaceImage(displayCard, 0) : "";

  return (
    <div className={`${transitions.page} ${styles.page}`}>
      <div className={styles.topBar}>
        <button type="button" className={styles.backLink} onClick={goBack}>
          ← Back
        </button>
        {card && <CardNameSwitcher currentName={card.name} />}
      </div>

      {loading && <p className={styles.status}>Loading card…</p>}
      {error && <p className={styles.statusError}>{error}</p>}

      {!loading && card && displayCard && (
        <>
          <div className={styles.layout}>
            <div className={styles.visual}>
              <div className={styles.imageFrame} title="Click card to enlarge">
                <CardImage
                  card={displayCard}
                  onActivate={() => enlargeSrc && setLightboxSrc(enlargeSrc)}
                />
              </div>
              {resolved &&
                (resolved.has_custom_art ||
                  resolved.has_preferred_printing) && (
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
              <CardDetail
                card={displayCard}
                hidePrintingMeta={Boolean(
                  resolved?.has_custom_art || resolved?.has_preferred_printing
                )}
              />
            </div>

            <div className={styles.artCol}>
              <CardArtPanel card={card} onResolvedChange={onResolvedChange} />
            </div>
          </div>

          <section className={styles.relatedSection} aria-label="Related">
            <div className={styles.relatedCard}>
              <h2 className={styles.relatedTitle}>In your decks</h2>
              <p className={styles.relatedBody}>
                Decks that include this card will appear here once deck storage
                is connected.
              </p>
              <Link to="/my-decks" className={styles.relatedLink}>
                Open My decks →
              </Link>
            </div>
            <div className={styles.relatedCard}>
              <h2 className={styles.relatedTitle}>Drawers & collections</h2>
              <p className={styles.relatedBody}>
                Collection binders and drawers that hold this card will list
                here in a later update.
              </p>
              <span className={styles.relatedSoon}>Coming soon</span>
            </div>
          </section>
        </>
      )}

      {lightboxSrc && (
        <CardLightbox
          src={lightboxSrc}
          alt={card?.name ?? "Card"}
          onClose={() => setLightboxSrc(null)}
        />
      )}
    </div>
  );
}
