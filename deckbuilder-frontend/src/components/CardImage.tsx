import { useState, type MouseEvent } from "react";

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
  /** Optional class on the outer frame */
  className?: string;
  /** Called when the main image area is activated (not control buttons) */
  onActivate?: (card: ScryfallCard) => void;
};

/**
 * Reusable card art viewer with double-faced controls.
 * Hover reveals Flip / Both when the card has multiple faces.
 */
export function CardImage({ card, className, onActivate }: CardImageProps) {
  const multi = isMultiCard(card);
  const faces = getFaces(card);
  const [view, setView] = useState<CardFaceView>("front");

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
            src={frontSrc}
            alt={frontName}
            className={styles.imageHalf}
            draggable={true}
          />
          <img
            src={backSrc}
            alt={backName}
            className={styles.imageHalf}
            draggable={true}
          />
        </div>
      ) : (
        <img
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
