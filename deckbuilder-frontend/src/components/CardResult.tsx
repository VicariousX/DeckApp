import { useMemo, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";

import type { ScryfallCard } from "../types/scryfallCard";
import { getFaces, isMultiCard } from "../utils/scryfall";
import { useDisplayCards } from "../hooks/useUserCardArt";
import type { CardFaceView } from "./CardImage";

import styles from "./CardResult.module.css";
import { CardImage } from "./CardImage";
import { CardInspectorModal } from "./CardInspectorModal";

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
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const list = useMemo(
    () =>
      pairs.map(({ original, display, resolved }) => ({
        originalId: original.id,
        display,
        hidePrintingMeta:
          resolved.has_custom_art || resolved.has_preferred_printing,
      })),
    [pairs]
  );

  if (cards.length === 0) {
    return null;
  }

  const gridStyle = {
    "--card-min": `${cardSize}px`,
  } as CSSProperties;

  const selected =
    selectedIndex != null && selectedIndex >= 0 && selectedIndex < list.length
      ? list[selectedIndex]
      : null;

  return (
    <>
      <div className={styles.resultsGrid} style={gridStyle}>
        {list.map((item, i) => (
          <ResultCard
            key={item.originalId}
            display={item.display}
            originalId={item.originalId}
            onSelect={() => setSelectedIndex(i)}
          />
        ))}
      </div>

      {selected && selectedIndex != null && (
        <CardInspectorModal
          scryfallId={selected.originalId}
          name={selected.display.name}
          onClose={() => setSelectedIndex(null)}
          hasPrev={selectedIndex > 0}
          hasNext={selectedIndex < list.length - 1}
          onPrev={() => setSelectedIndex((i) => (i != null && i > 0 ? i - 1 : i))}
          onNext={() =>
            setSelectedIndex((i) =>
              i != null && i < list.length - 1 ? i + 1 : i
            )
          }
        />
      )}
    </>
  );
}
