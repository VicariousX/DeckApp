import { useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";

import type { ScryfallCard } from "../types/scryfallCard";
import { getFaces, isMultiCard } from "../utils/scryfall";
import { useDisplayCards } from "../hooks/useUserCardArt";
import type { CardFaceView } from "./CardImage";

import styles from "./CardResult.module.css";
import { Modal } from "./Modal";
import { CardDetail } from "./CardDetail";
import { CardImage } from "./CardImage";
import { DrawerPicker } from "./DrawerPicker";

type CardResultProps = {
  cards: ScryfallCard[];
  cardSize?: number;
};

function ResultCard({
  display,
  originalId,
  onSelect,
}: {
  display: ScryfallCard;
  originalId: string;
  onSelect: (card: ScryfallCard) => void;
}) {
  const faces = getFaces(display);
  const [view, setView] = useState<CardFaceView>("front");
  const expanded = view === "both";

  return (
    <div
      className={`${styles.cardWrapper} ${
        expanded ? styles.cardWrapperExpanded : ""
      }`}
    >
      <CardImage
        card={display}
        onActivate={onSelect}
        onViewChange={setView}
      />

      <div className={styles.cardName}>
        {faces[0].name}
        {isMultiCard(display) && (
          <span className={styles.cardNameMuted}> · DFC</span>
        )}
      </div>

      <Link
        to={`/card/${originalId}`}
        className={styles.cardPageMiniLink}
        onClick={(e) => e.stopPropagation()}
      >
        Card page
      </Link>
    </div>
  );
}

export function CardResult({ cards, cardSize = 240 }: CardResultProps) {
  const { pairs } = useDisplayCards(cards);
  const [selected, setSelected] = useState<{
    display: ScryfallCard;
    originalId: string;
    hidePrintingMeta: boolean;
  } | null>(null);

  if (cards.length === 0) {
    return null;
  }

  const gridStyle = {
    "--card-min": `${cardSize}px`,
  } as CSSProperties;

  return (
    <>
      <div className={styles.resultsGrid} style={gridStyle}>
        {pairs.map(({ original, display, resolved }) => (
          <ResultCard
            key={original.id}
            display={display}
            originalId={original.id}
            onSelect={() =>
              setSelected({
                display,
                originalId: original.id,
                hidePrintingMeta:
                  resolved.has_custom_art || resolved.has_preferred_printing,
              })
            }
          />
        ))}
      </div>

      {selected && (
        <Modal onClose={() => setSelected(null)}>
          <CardDetail
            card={selected.display}
            hidePrintingMeta={selected.hidePrintingMeta}
          />
          <div className={styles.modalActions}>
            {(selected.display.oracle_id || selected.display.id) && (
              <DrawerPicker
                oracleId={(selected.display.oracle_id ?? selected.display.id).toLowerCase()}
                scryfallCard={selected.display}
              />
            )}
            <p className={styles.modalActionsHint}>
              Art preferences and full details live on the card page.
            </p>
            <Link
              to={`/card/${selected.originalId}`}
              className={styles.cardPageLink}
              onClick={() => setSelected(null)}
            >
              Open card page →
            </Link>
          </div>
        </Modal>
      )}
    </>
  );
}
