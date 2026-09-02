import {
  getFaces,
  getImage,
  getOracleText,
  isMultiCard
} from "../utils/scryfall";

import type { ScryfallCard } from "../types/scryfall";
import { useState } from "react";




export function CardDetail({ card }: { card: ScryfallCard }) {
  const [faceIndex, setFaceIndex] = useState(0);
  const [showBoth, setShowBoth] = useState(false);

  const faces = getFaces(card);
  const isMulti = isMultiCard(card);

  return (
    <div className="card-detail">
      <h2>{card.name}</h2>

      {/* Images */}
      <div className="card-detail-images">
        {showBoth ? (
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
        ) : (
          <img
            src={getImage(card, faceIndex)}
            alt={faces[faceIndex].name}
            className="card-image"
          />
        )}
      </div>

      {/* Face controls */}
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

      {/* Card text */}
      <div className="card-text">
        <p><strong>Type:</strong> {faces[faceIndex].type_line}</p>
        <p><strong>Oracle Text:</strong></p>
        <pre>{getOracleText(card)}</pre>
      </div>

      {/* Metadata */}
      <div className="card-meta">
        <p><strong>Set:</strong> {card.set_name} ({card.set.toUpperCase()})</p>
        <p><strong>Rarity:</strong> {card.rarity}</p>
        <p><strong>Collector #:</strong> {card.collector_number}</p>
      </div>
    </div>
  );
}
