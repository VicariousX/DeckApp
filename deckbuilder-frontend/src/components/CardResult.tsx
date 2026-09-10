import { useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";

import type { ScryfallCard } from "../types/scryfallCard";
import { getFaces, isMultiCard } from "../utils/scryfall";
import type { CardFaceView } from "./CardImage";

import styles from "./CardResult.module.css";
import { Modal } from "./Modal";
import { CardDetail } from "./CardDetail";
import { CardImage } from "./CardImage";

type CardResultProps = {
  cards: ScryfallCard[];
  cardSize?: number;
};

function ResultCard({
  card,
  onSelect,
}: {
  card: ScryfallCard;
  onSelect: (card: ScryfallCard) => void;
}) {
  const faces = getFaces(card);
  const [view, setView] = useState<CardFaceView>("front");
  const expanded = view === "both";

  return (
    <div
      className={`${styles.cardWrapper} ${
        expanded ? styles.cardWrapperExpanded : ""
      }`}
    >
      <CardImage
        card={card}
        onActivate={onSelect}
        onViewChange={setView}
      />

      <div className={styles.cardName}>
        {faces[0].name}
        {isMultiCard(card) && (
          <span className={styles.cardNameMuted}> · DFC</span>
        )}
      </div>
    </div>
  );
}

export function CardResult({ cards, cardSize = 240 }: CardResultProps) {
  const [selectedCard, setSelectedCard] = useState<ScryfallCard | null>(null);

  if (cards.length === 0) {
    return null;
  }

  const gridStyle = {
    "--card-min": `${cardSize}px`,
  } as CSSProperties;

  return (
    <>
      <div className={styles.resultsGrid} style={gridStyle}>
        {cards.map((card) => (
          <ResultCard
            key={card.id}
            card={card}
            onSelect={setSelectedCard}
          />
        ))}
      </div>

      {selectedCard && (
        <Modal onClose={() => setSelectedCard(null)}>
          <CardDetail card={selectedCard} />
          <div className={styles.modalActions}>
            <Link
              to={`/card/${selectedCard.id}`}
              className={styles.cardPageLink}
              onClick={() => setSelectedCard(null)}
            >
              Open full card page →
            </Link>
          </div>
        </Modal>
      )}
    </>
  );
}
