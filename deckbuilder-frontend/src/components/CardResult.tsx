import { useState } from "react";

import type { ScryfallCard } from "../types/scryfallCard";
import { getFaces, isMultiCard } from "../utils/scryfall";

import styles from "./CardResult.module.css";
import { Modal } from "./Modal";
import { CardDetail } from "./CardDetail";
import { CardImage } from "./CardImage";

export function CardResult({ cards }: { cards: ScryfallCard[] }) {
  const [selectedCard, setSelectedCard] = useState<ScryfallCard | null>(null);

  return (
    <>
      <div className={styles.resultsGrid}>
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
