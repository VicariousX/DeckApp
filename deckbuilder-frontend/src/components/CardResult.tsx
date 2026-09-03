import { useState } from "react";
import type { ScryfallCard } from "../types/scryfall";

import styles from "./CardResult.module.css";


import {
  isMultiCard,
  getFaces,
  getImage
} from "../utils/scryfall";

export function CardResult({ card, onClick }: { card: ScryfallCard; onClick?: () => void }) {
  const [showBoth, setShowBoth] = useState(false);
  const [faceIndex, setFaceIndex] = useState(0);

  const faces = getFaces(card);
  const isMulti = isMultiCard(card);

  function renderImage() {
    // Show both faces side-by-side
    if (showBoth) {
      return (
        <div className="card-faces">
          {faces.map((face) => (
            <img
              key={face.name}
              src={face.image_uris?.normal}
              alt={face.name}
              className="card-image"
            />
          ))}
        </div>
      );
    }

    // Default: show one face (front or toggled)
    return (
      <img
        src={getImage(card, faceIndex)}
        alt={faces[faceIndex].name}
        className="card-image"
      />
    );
  }

  return (
    <div className={styles.cardResult} onClick={onClick}>
      {renderImage()}

      {isMulti && (
        <div className="face-controls">
          <button onClick={() => setShowBoth(!showBoth)}>
            {showBoth ? "Show One Face" : "Show Both Faces"}
          </button>

          {!showBoth && (
            <button
              onClick={() =>
                setFaceIndex((faceIndex + 1) % faces.length)
              }
            >
              Flip Card
            </button>
          )}
        </div>
      )}
    </div>
  );
}
