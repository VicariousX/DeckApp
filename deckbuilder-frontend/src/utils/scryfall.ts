import type {
  ScryfallCard,
  ScryfallMultiCard,
  ScryfallSingleCard,
  ScryfallCardFace
} from "../types/scryfall";

export function isMultiCard(card: ScryfallCard): card is ScryfallMultiCard {
  return "card_faces" in card && Array.isArray(card.card_faces);
}

// Always returns an array of faces, even for single‑faced cards.
export function getFaces(card: ScryfallCard): ScryfallCardFace[] {
  if (isMultiCard(card)) {
    return card.card_faces;
  }

  // Convert single-faced card into a "face-like" structure
  return [
    {
      name: card.name,
      type_line: card.type_line,
      oracle_text: card.oracle_text,
      mana_cost: card.mana_cost,
      colors: card.colors,
      image_uris: card.image_uris
    }
  ];
}

// Useful for:
// deck lists
// autocomplete
// hover previews
// commander legality
// card detail pages
export function getFrontFace(card: ScryfallCard): ScryfallCardFace {
  return getFaces(card)[0];
}

// This is used everywhere images appear.
export function getImage(card: ScryfallCard, faceIndex = 0): string | undefined {
  const faces = getFaces(card);
  return faces[faceIndex]?.image_uris?.normal;
}


// This is used in:
// card detail
// deck legality
// rules text display
// hover previews
export function getOracleText(card: ScryfallCard): string | undefined {
  const faces = getFaces(card);
  return faces.map(f => f.oracle_text).filter(Boolean).join("\n\n");
}
