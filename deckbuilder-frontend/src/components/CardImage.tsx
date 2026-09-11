import { useEffect, useState, type MouseEvent } from "react";

import type { ScryfallCard } from "../types/scryfallCard";
import {
  getFaceImage,
  getFaces,
  isMultiCard,
} from "../utils/scryfall";

import styles from "./CardImage.module.css";

export type CardFaceView = "front" | "back" | "both";

type CardImageProps = {
  card: ScryfallCard;
  className?: string;
  onActivate?: (card: ScryfallCard) => void;
  onViewChange?: (view: CardFaceView) => void;
};

export function CardImage({
  card,
  className,
  onActivate,
  onViewChange,
}: CardImageProps) {
  const multi = isMultiCard(card);
  const faces = getFaces(card);
  const [view, setView] = useState<CardFaceView>("front");

  useEffect(() => {
    onViewChange?.(view);
  }, [view, onViewChange]);

  const frontSrc = getFaceImage(card, 0);
  const backSrc = multi ? getFaceImage(card, 1) : "";

  const frontName = faces[0]?.name ?? card.name;
  const backName = faces[1]?.name ?? "Back";

  function stop(e: MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
  }

  function cycleFlip(e: MouseEvent) {
    stop(e);
    setView((v) => (v === "back" ? "front" : "back"));
  }

  function toggleBoth(e: MouseEvent) {
    stop(e);
    setView((v) => (v === "both" ? "front" : "both"));
  }

  const frameClass = [
    styles.frame,
    multi ? styles.frameMulti : "",
    view === "both" ? styles.frameBoth : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={frameClass}
      onClick={() => onActivate?.(card)}
      role={onActivate ? "button" : undefined}
      tabIndex={onActivate ? 0 : undefined}
      onKeyDown={
        onActivate
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onActivate(card);
              }
            }
          : undefined
      }
    >
      {view === "both" && multi ? (
        <div className={styles.both}>
          <img
            key={`f-${frontSrc}`}
            src={frontSrc}
            alt={frontName}
            className={styles.imageHalf}
            draggable={true}
          />
          <img
            key={`b-${backSrc}`}
            src={backSrc}
            alt={backName}
            className={styles.imageHalf}
            draggable={true}
          />
        </div>
      ) : (
        <img
          key={view === "back" && multi ? backSrc : frontSrc}
          src={view === "back" && multi ? backSrc : frontSrc}
          alt={view === "back" && multi ? backName : frontName}
          className={styles.image}
          draggable={true}
        />
      )}

      {multi && (
        <div className={styles.controls} onClick={stop}>
          <button
            type="button"
            className={styles.controlBtn}
            onClick={cycleFlip}
            title={view === "back" ? "Show front" : "Flip card"}
            aria-label={view === "back" ? "Show front face" : "Flip to back face"}
          >
            Flip
          </button>
          <button
            type="button"
            className={`${styles.controlBtn} ${
              view === "both" ? styles.controlBtnActive : ""
            }`}
            onClick={toggleBoth}
            title={view === "both" ? "Single face" : "Show both faces"}
            aria-label={
              view === "both" ? "Show one face" : "Show both faces at once"
            }
          >
            Both
          </button>
        </div>
      )}
    </div>
  );
}
