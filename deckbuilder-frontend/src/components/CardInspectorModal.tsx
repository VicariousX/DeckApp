import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchCardById } from "../lib/scryfallApi";
import type { DeckBoard, DeckCard, DeckTag } from "../types/deck";
import type { ScryfallCard } from "../types/scryfallCard";
import { CardDetail } from "./CardDetail";
import { CardImage } from "./CardImage";
import { CardArtPanel } from "./CardArtPanel";
import { DrawerPicker } from "./DrawerPicker";
import { Modal } from "./Modal";
import styles from "./CardInspectorModal.module.css";

const BOARDS: { id: DeckBoard; label: string }[] = [
  { id: "commander", label: "Commander" },
  { id: "main", label: "Mainboard" },
  { id: "side", label: "Sideboard" },
  { id: "maybe", label: "Maybeboard" },
];

export type CardInspectorDeckControls = {
  card: DeckCard;
  isOwner: boolean;
  tags: DeckTag[];
  onQty: (delta: number) => void;
  onBoard: (board: DeckBoard) => void;
  onRemove: () => void;
  onToggleTag: (tag: DeckTag) => void;
};

type Props = {
  scryfallId: string;
  name?: string;
  imageUrl?: string;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
  deck?: CardInspectorDeckControls;
};

export function CardInspectorModal({
  scryfallId,
  name,
  imageUrl,
  onClose,
  onPrev,
  onNext,
  hasPrev = false,
  hasNext = false,
  deck,
}: Props) {
  const [scryfall, setScryfall] = useState<ScryfallCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      const { card: c, error: err } = await fetchCardById(scryfallId);
      if (cancelled) return;
      if (err || !c) {
        setError(err ?? "Could not load card details.");
        setScryfall(null);
        setLoading(false);
        return;
      }
      setScryfall(c);
      setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [scryfallId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft" && hasPrev && onPrev) {
        e.preventDefault();
        onPrev();
      }
      if (e.key === "ArrowRight" && hasNext && onNext) {
        e.preventDefault();
        onNext();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hasPrev, hasNext, onPrev, onNext]);

  const displayName = scryfall?.name ?? name ?? "Card";
  const assigned = new Set(deck?.card.tag_ids ?? []);

  return (
    <Modal onClose={onClose}>
      <div className={styles.shell}>
        {(hasPrev || hasNext) && (
          <div className={styles.navRow}>
            <button
              type="button"
              className={styles.navBtn}
              disabled={!hasPrev}
              onClick={onPrev}
              aria-label="Previous card"
            >
              ← Prev
            </button>
            <span className={styles.navHint}>← → keys</span>
            <button
              type="button"
              className={styles.navBtn}
              disabled={!hasNext}
              onClick={onNext}
              aria-label="Next card"
            >
              Next →
            </button>
          </div>
        )}

        <div className={styles.layout}>
          <div className={styles.visual}>
            {loading && (
              <div className={styles.imagePlaceholder}>Loading…</div>
            )}
            {!loading && scryfall && (
              <CardImage
                card={scryfall}
                overrideFrontSrc={imageUrl}
                bothLayout="stack"
              />
            )}
            {!loading && !scryfall && (
              imageUrl ? (
                <img src={imageUrl} alt={displayName} className={styles.image} />
              ) : (
                <div className={styles.imagePlaceholder}>{displayName}</div>
              )
            )}
          </div>

          <div className={styles.body}>
            <div className={styles.scrollRegion}>
            {error && (
              <p className={styles.error} role="alert">
                {error}
              </p>
            )}
            {scryfall && (
              <CardDetail card={scryfall} hidePrintingMeta={Boolean(imageUrl)} />
            )}
            {!scryfall && !loading && (
              <h2 className={styles.fallbackTitle}>{displayName}</h2>
            )}

            {deck && (
              <div className={styles.deckExtras}>
                <div className={styles.qtyRow}>
                  <span className={styles.extraLabel}>Quantity</span>
                  <div className={styles.qtyControls}>
                    <button
                      type="button"
                      className={styles.qtyBtn}
                      disabled={!deck.isOwner}
                      onClick={() => deck.onQty(-1)}
                    >
                      −
                    </button>
                    <span className={styles.qtyValue}>{deck.card.quantity}</span>
                    <button
                      type="button"
                      className={styles.qtyBtn}
                      disabled={!deck.isOwner}
                      onClick={() => deck.onQty(1)}
                    >
                      +
                    </button>
                  </div>
                </div>

                <label className={styles.boardRow}>
                  <span className={styles.extraLabel}>Board</span>
                  <select
                    className={styles.boardSelect}
                    value={deck.card.board}
                    disabled={!deck.isOwner}
                    onChange={(e) =>
                      deck.onBoard(e.target.value as DeckBoard)
                    }
                  >
                    {BOARDS.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.label}
                      </option>
                    ))}
                  </select>
                </label>

                {deck.tags.length > 0 && (
                  <div className={styles.tagsBlock}>
                    <span className={styles.extraLabel}>Deck tags</span>
                    <div className={styles.tagList}>
                      {deck.tags.map((tag) => {
                        const on = assigned.has(tag.id);
                        return (
                          <button
                            key={tag.id}
                            type="button"
                            className={`${styles.tagChip}${
                              on ? ` ${styles.tagChipOn}` : ""
                            }`}
                            disabled={!deck.isOwner}
                            style={
                              on
                                ? {
                                    borderColor: tag.color,
                                    background: `${tag.color}33`,
                                  }
                                : undefined
                            }
                            onClick={() => deck.onToggleTag(tag)}
                          >
                            {tag.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {deck.isOwner && (
                  <button
                    type="button"
                    className={styles.removeBtn}
                    onClick={deck.onRemove}
                  >
                    Remove from deck
                  </button>
                )}
              </div>
            )}

            {scryfall && (
              <div className={styles.artSlot}>
                <CardArtPanel card={scryfall} />
              </div>
            )}
            </div>

            <div className={styles.actions}>
              {scryfall && (
                <DrawerPicker
                  oracleId={(scryfall.oracle_id ?? scryfall.id).toLowerCase()}
                  scryfallCard={scryfall}
                />
              )}
              <Link
                to={`/card/${scryfallId}`}
                className={styles.detailLink}
                onClick={onClose}
              >
                Open card page →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
