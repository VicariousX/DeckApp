import { useState, type CSSProperties } from "react";

import type { ScryfallCard } from "../types/scryfallCard";
import { getFaces, isMultiCard } from "../utils/scryfall";

import styles from "./CardResult.module.css";
import { Modal } from "./Modal";
import { CardDetail } from "./CardDetail";
import { CardImage } from "./CardImage";

const SIZE_MIN = 160;
const SIZE_MAX = 340;
const SIZE_DEFAULT = 240;

export function CardResult({ cards }: { cards: ScryfallCard[] }) {
  const [selectedCard, setSelectedCard] = useState<ScryfallCard | null>(null);
  const [cardSize, setCardSize] = useState(SIZE_DEFAULT);

  if (cards.length === 0) {
    return null;
  }

  const gridStyle = {
    "--card-min": `${cardSize}px`,
  } as CSSProperties;

  return (
    <>
      <div className={styles.toolbar}>
        <label className={styles.sizeControl} htmlFor="card-size">
          <span className={styles.sizeLabel}>Card size</span>
          <input
            id="card-size"
            className={styles.sizeRange}
            type="range"
            min={SIZE_MIN}
            max={SIZE_MAX}
            step={10}
            value={cardSize}
            onChange={(e) => setCardSize(Number(e.target.value))}
            aria-valuemin={SIZE_MIN}
            aria-valuemax={SIZE_MAX}
            aria-valuenow={cardSize}
          />
          <span className={styles.sizeValue}>{cardSize}px</span>
        </label>
      </div>

      <div className={styles.resultsGrid} style={gridStyle}>
        {cards.map((card) => {
          const faces = getFaces(card);

          return (
            <div key={card.id} className={styles.cardWrapper}>
              <CardImage
                card={card}
                onActivate={() => setSelectedCard(card)}
              />

              <div className={styles.cardName}>
                {faces[0].name}
                {isMultiCard(card) && (
                  <span className={styles.cardNameMuted}> \u00b7 DFC</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {selectedCard && (
        <Modal onClose={() => setSelectedCard(null)}>
          <CardDetail card={selectedCard} />
        </Modal>
      )}
    </>
  );
}
