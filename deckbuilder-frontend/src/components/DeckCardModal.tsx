import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchCardById } from "../lib/scryfallApi";
import type { DeckBoard, DeckCard, DeckTag } from "../types/deck";
import type { ScryfallCard } from "../types/scryfallCard";
import { CardDetail } from "./CardDetail";
import { CardImage } from "./CardImage";
import { Modal } from "./Modal";
import styles from "./DeckCardModal.module.css";
import { DrawerPicker } from "./DrawerPicker";

const BOARDS: { id: DeckBoard; label: string }[] = [
  { id: "commander", label: "Commander" },
  { id: "main", label: "Mainboard" },
  { id: "side", label: "Sideboard" },
  { id: "maybe", label: "Maybeboard" },
];

type Props = {
  card: DeckCard;
  imageUrl?: string;
  isOwner: boolean;
  tags: DeckTag[];
  onClose: () => void;
  onQty: (delta: number) => void;
  onBoard: (board: DeckBoard) => void;
  onRemove: () => void;
  onToggleTag: (tag: DeckTag) => void;
};

export function DeckCardModal({
  card,
  imageUrl,
  isOwner,
  tags,
  onClose,
  onQty,
  onBoard,
  onRemove,
  onToggleTag,
}: Props) {
  const [scryfall, setScryfall] = useState<ScryfallCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      const { card: c, error: err } = await fetchCardById(card.scryfall_id);
      if (cancelled) return;
      if (err || !c) {
        setError(err ?? "Could not load card details.");
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
  }, [card.scryfall_id]);

  const assigned = new Set(card.tag_ids ?? []);

  return (
    <Modal onClose={onClose}>
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
              <img src={imageUrl} alt={card.name} className={styles.image} />
            ) : (
              <div className={styles.imagePlaceholder}>{card.name}</div>
            )
          )}
        </div>
        <div className={styles.body}>
          {error && <p className={styles.error}>{error}</p>}
          {!loading && scryfall && (
            <CardDetail card={scryfall} hidePrintingMeta={Boolean(imageUrl)} />
          )}
          {!loading && !scryfall && !error && (
            <div className={styles.fallback}>
              <h2 className={styles.fallbackName}>{card.name}</h2>
              {card.type_line && (
                <p className={styles.fallbackType}>{card.type_line}</p>
              )}
              {card.mana_cost && (
                <p className={styles.fallbackMeta}>{card.mana_cost}</p>
              )}
            </div>
          )}

          {isOwner && (
            <div className={styles.controls}>
              <div className={styles.qtyRow}>
                <button
                  type="button"
                  className={styles.qtyBtn}
                  onClick={() => onQty(-1)}
                  aria-label="Decrease quantity"
                >
                  −
                </button>
                <span className={styles.qtyValue}>{card.quantity}</span>
                <button
                  type="button"
                  className={styles.qtyBtn}
                  onClick={() => onQty(1)}
                  aria-label="Increase quantity"
                >
                  +
                </button>
              </div>
              <select
                className={styles.boardSelect}
                value={card.board}
                aria-label="Board"
                onChange={(e) => onBoard(e.target.value as DeckBoard)}
              >
                {BOARDS.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className={styles.removeBtn}
                onClick={() => {
                  onRemove();
                  onClose();
                }}
              >
                Remove from deck
              </button>
            </div>
          )}

          <div className={styles.tagSection}>
            <div className={styles.tagSectionLabel}>Tags</div>
            {tags.length === 0 ? (
              <p className={styles.tagHint}>
                No deck tags yet. Create some in the Tags panel.
              </p>
            ) : (
              <div className={styles.tagList}>
                {tags.map((t) => {
                  const on = assigned.has(t.id);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      disabled={!isOwner}
                      className={
                        on
                          ? `${styles.tagChip} ${styles.tagChipOn}`
                          : styles.tagChip
                      }
                      onClick={() => isOwner && onToggleTag(t)}
                      aria-pressed={on}
                    >
                      {t.name}
                      {on && <span aria-hidden>×</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {isOwner && card.oracle_id && (
            <div className={styles.drawerRow}>
              <DrawerPicker
                oracleId={card.oracle_id}
                scryfallCard={scryfall}
              />
            </div>
          )}

          <div className={styles.footer}>
            <Link
              to={`/card/${card.scryfall_id}`}
              className={styles.cardPageLink}
              onClick={onClose}
            >
              Open card page →
            </Link>
          </div>
        </div>
      </div>
    </Modal>
  );
}
