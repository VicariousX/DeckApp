import type { DeckAppCard } from "../types/deckAppCard";
import type { ScryfallCard, ScryfallCardFace } from "../types/scryfallCard";

export function getFaces(card: ScryfallCard): ScryfallCardFace[] {
  if (card.card_faces && card.card_faces.length > 0) {
    return card.card_faces;
  }

  return [
    {
      name: card.name,
      type_line: card.type_line,
      mana_cost: card.mana_cost ?? "",
      oracle_text: card.oracle_text ?? "",
      artist: card.artist ?? "",
      image_uris: card.image_uris ?? null,
    },
  ];
}

export function isMultiCard(
  card: ScryfallCard
): card is ScryfallCard & { card_faces: ScryfallCardFace[] } {
  return Array.isArray(card.card_faces) && card.card_faces.length > 1;
}

/** Prefer normal, then large, then small for a given image_uris blob */
function pickUri(
  uris?: {
    small?: string;
    normal?: string;
    large?: string;
  } | null
): string {
  if (!uris) return "";
  return uris.normal ?? uris.large ?? uris.small ?? "";
}

/**
 * Image for a specific face index (0 = front).
 * Falls back to the card-level image_uris when a face has none.
 */
export function getFaceImage(card: ScryfallCard, faceIndex = 0): string {
  if (isMultiCard(card)) {
    const face = card.card_faces[faceIndex] ?? card.card_faces[0];
    const fromFace = pickUri(face?.image_uris);
    if (fromFace) return fromFace;
  }

  return pickUri(card.image_uris);
}

/** Front-face image (same as historical getImage behavior). */
export function getImage(card: ScryfallCard): string {
  return getFaceImage(card, 0);
}

export function getOracleText(card: ScryfallCard): string {
  if (!isMultiCard(card)) {
    return card.oracle_text ?? "";
  }

  const faces = card.card_faces ?? [];

  return faces
    .map((face) => {
      const header = `// ${face.name}`;
      const text = face.oracle_text ?? "";
      return `${header}\n${text}`;
    })
    .join("\n\n");
}

/* -------------------------------------------------------------------------- */
/* DeckAppCard helpers (resolved images already applied)                      */
/* -------------------------------------------------------------------------- */

export function isDeckAppCard(card: ScryfallCard | DeckAppCard): card is DeckAppCard {
  return Array.isArray((card as DeckAppCard).faces);
}

export function getDeckAppFaceImage(card: DeckAppCard, faceIndex = 0): string {
  const face = card.faces[faceIndex] ?? card.faces[0];
  return face?.image_url ?? "";
}

export function getDeckAppImage(card: DeckAppCard): string {
  return getDeckAppFaceImage(card, 0);
}

export function isMultiDeckAppCard(card: DeckAppCard): boolean {
  return card.faces.length > 1;
}
