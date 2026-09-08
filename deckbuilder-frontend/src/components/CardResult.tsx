import { useState } from "react";

import type { ScryfallCard } from "../types/scryfallCard";
import {
  getFaces,
  getImage,
  isMultiCard
} from "../utils/scryfall";

import styles from "./CardResult.module.css";
import { Modal } from "./Modal";
import { CardDetail } from "./CardDetail";

export function CardResult({ cards }: { cards: ScryfallCard[] }) {
  const [selectedCard, setSelectedCard] = useState<ScryfallCard | null>(null);

  return (
    <>
      <div className={styles.resultsGrid}>
        {cards.map((card) => {
          const faces = getFaces(card);
          const image = getImage(card);

          return (
            <div
              key={card.id}
              className={styles.cardWrapper}
              onClick={() => setSelectedCard(card)}
            >
              <img
                src={image}
                alt={faces[0].name}
                className={styles.cardImage}
              />

              <div className={styles.cardName}>
                {faces[0].name}
                {isMultiCard(card) && (
                  <span className={styles.cardNameMuted}> (Multi‑Face)</span>
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
