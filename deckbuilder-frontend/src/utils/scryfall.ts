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
      image_uris: card.image_uris ?? null
    }
  ];
}

export function isMultiCard(
  card: ScryfallCard
): card is ScryfallCard & { card_faces: ScryfallCardFace[] } {
  return Array.isArray(card.card_faces) && card.card_faces.length > 1;
}

export function getImage(card: ScryfallCard): string {
  if (isMultiCard(card)) {
    const front = card.card_faces[0];
    if (front.image_uris?.normal) return front.image_uris.normal;
    if (front.image_uris?.large) return front.image_uris.large;
  }

  if (card.image_uris?.normal) return card.image_uris.normal;
  if (card.image_uris?.large) return card.image_uris.large;

  return "";
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
