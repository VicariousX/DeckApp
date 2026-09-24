import { useMemo, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";

import type { ScryfallCard } from "../types/scryfallCard";
import { getFaces, isMultiCard } from "../utils/scryfall";
import { useDisplayCards } from "../hooks/useUserCardArt";
import type { CardFaceView } from "./CardImage";

import styles from "./CardResult.module.css";
import { CardEnlargeOverlay, CardImage } from "./CardImage";
import { CardInspectorModal } from "./CardInspectorModal";
import {
  CardContextMenu,
  type ModalJump,
} from "./CardContextMenu";
import { getFaceImage } from "../utils/scryfall";

type CardResultProps = {
  cards: ScryfallCard[];
  cardSize?: number;
  viewMode?: "image" | "text";
  previewFirst?: boolean;
};

function ResultCard({
  display,
  originalId,
  onSelect,
  onContext,
}: {
  display: ScryfallCard;
  originalId: string;
  onSelect: (card: ScryfallCard) => void;
  onContext: (e: { preventDefault: () => void; clientX: number; clientY: number }) => void;
}) {
  const faces = getFaces(display);
  const [view, setView] = useState<CardFaceView>("front");
  const expanded = view === "both";

  return (
    <div
      className={`${styles.cardWrapper} ${
        expanded ? styles.cardWrapperExpanded : ""
      }`}
      onContextMenu={(e) => {
        e.preventDefault();
        onContext(e);
      }}
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

export function CardResult({
  cards,
  cardSize = 240,
  viewMode = "image",
  previewFirst = false,
}: CardResultProps) {
  const { pairs } = useDisplayCards(cards);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [modalJump, setModalJump] = useState<ModalJump>("info");
  const [ctx, setCtx] = useState<{ x: number; y: number; index: number } | null>(
    null
  );

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

  const preview =
    previewIndex != null && previewIndex >= 0 && previewIndex < list.length
      ? list[previewIndex]
      : null;

  return (
    <>
      {viewMode === "text" ? (
        <ul className={styles.textList}>
          {list.map((item, i) => (
            <li key={item.originalId}>
              <button
                type="button"
                className={styles.textRow}
                onClick={() =>
                  previewFirst ? setPreviewIndex(i) : setSelectedIndex(i)
                }
                onContextMenu={(e) => {
                  e.preventDefault();
                  setCtx({ x: e.clientX, y: e.clientY, index: i });
                }}
              >
                <span className={styles.textName}>{item.display.name}</span>
                <span className={styles.textType}>{item.display.type_line}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className={styles.resultsGrid} style={gridStyle}>
          {list.map((item, i) => (
            <ResultCard
              key={item.originalId}
              display={item.display}
              originalId={item.originalId}
              onSelect={() =>
                previewFirst ? setPreviewIndex(i) : setSelectedIndex(i)
              }
              onContext={(e) =>
                setCtx({ x: e.clientX, y: e.clientY, index: i })
              }
            />
          ))}
        </div>
      )}

      {preview && previewIndex != null && (
        <CardEnlargeOverlay
          frontSrc={getFaceImage(preview.display, 0)}
          backSrc={getFaceImage(preview.display, 1) || ""}
          frontName={preview.display.name}
          backName={preview.display.card_faces?.[1]?.name ?? "Back"}
          multi={isMultiCard(preview.display)}
          onClose={() => setPreviewIndex(null)}
          onActivate={() => {
            setSelectedIndex(previewIndex);
            setPreviewIndex(null);
          }}
          hint="Click the card for details · click outside to close"
        />
      )}

      {ctx && list[ctx.index] && (
        <CardContextMenu
          x={ctx.x}
          y={ctx.y}
          target={{
            scryfallId: list[ctx.index].originalId,
            oracleId: list[ctx.index].display.oracle_id,
            name: list[ctx.index].display.name,
            typeLine: list[ctx.index].display.type_line,
            imageUrl: getFaceImage(list[ctx.index].display, 0),
            imageUrlBack: getFaceImage(list[ctx.index].display, 1) || undefined,
          }}
          onClose={() => setCtx(null)}
          onEnhance={() => {
            setPreviewIndex(ctx.index);
            setCtx(null);
          }}
          onOpenModal={(jump) => {
            setModalJump(jump);
            setSelectedIndex(ctx.index);
          }}
        />
      )}

      {selected && selectedIndex != null && (
        <CardInspectorModal
          key={`${selected.originalId}-${modalJump}`}
          initialTab={
            modalJump.startsWith("artwork")
              ? "artwork"
              : modalJump.startsWith("info")
                ? "info"
                : modalJump === "deck" || modalJump === "drawers"
                  ? modalJump
                  : "info"
          }
          initialInfoSub={modalJump === "info:rulings" ? "rulings" : "details"}
          initialArtSub={modalJump === "artwork:upload" ? "upload" : "prints"}
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
