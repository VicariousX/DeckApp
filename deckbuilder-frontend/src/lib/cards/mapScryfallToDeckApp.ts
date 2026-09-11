import type { DeckAppCard, DeckAppCardFace, UserCardArt } from "../../types/deckAppCard";
import type { ScryfallCard, ScryfallCardFace, ScryfallImageUris } from "../../types/scryfallCard";

function pickUri(uris?: ScryfallImageUris | null): string {
  if (!uris) return "";
  return uris.normal ?? uris.large ?? uris.small ?? uris.png ?? "";
}

function faceFromScryfall(
  face: ScryfallCardFace,
  fallbackUris?: ScryfallImageUris | null
): DeckAppCardFace {
  const uris = face.image_uris ?? fallbackUris ?? null;
  return {
    name: face.name,
    type_line: face.type_line,
    mana_cost: face.mana_cost,
    oracle_text: face.oracle_text,
    artist: face.artist,
    image_uris: uris,
    image_url: pickUri(uris),
  };
}

/**
 * Normalize a Scryfall card into the DeckApp model (no user overrides yet).
 */
export function mapScryfallToDeckApp(card: ScryfallCard): DeckAppCard {
  const oracleId = (card.oracle_id ?? card.id).toLowerCase();
  const multi =
    Array.isArray(card.card_faces) && card.card_faces.length > 0
      ? card.card_faces
      : null;

  const faces: DeckAppCardFace[] = multi
    ? multi.map((f) => faceFromScryfall(f, card.image_uris))
    : [
        {
          name: card.name,
          type_line: card.type_line,
          mana_cost: card.mana_cost,
          oracle_text: card.oracle_text,
          artist: card.artist,
          image_uris: card.image_uris ?? null,
          image_url: pickUri(card.image_uris),
        },
      ];

  return {
    id: card.id,
    scryfall_id: card.id,
    oracle_id: oracleId,
    name: card.name,
    type_line: card.type_line,
    mana_cost: card.mana_cost,
    oracle_text: card.oracle_text,
    cmc: card.cmc,
    colors: card.colors,
    color_identity: card.color_identity,
    set: card.set,
    set_name: card.set_name,
    rarity: card.rarity,
    collector_number: card.collector_number,
    layout: card.layout,
    flavor_text: card.flavor_text,
    artist: card.artist,
    scryfall_uri: card.scryfall_uri,
    lang: card.lang,
    faces,
    has_custom_art: false,
    has_preferred_printing: false,
  };
}

export type ResolveArtOptions = {
  /**
   * Public base URL for the card-art bucket, e.g.
   * `${VITE_SUPABASE_URL}/storage/v1/object/public/card-art`
   */
  publicStorageBase: string;
  /**
   * Optional map of scryfall printing id → card when the user preferred a
   * different printing than the one currently in hand.
   */
  preferredPrintings?: Map<string, ScryfallCard>;
};

/**
 * Apply a user's art preference onto a base DeckApp card.
 * Custom uploads win over preferred Scryfall printings.
 */
export function applyUserCardArt(
  base: DeckAppCard,
  art: UserCardArt | null | undefined,
  options: ResolveArtOptions
): DeckAppCard {
  if (!art) return base;

  let result = { ...base, faces: base.faces.map((f) => ({ ...f })) };
  let hasPreferred = false;
  let hasCustom = false;

  // Preferred printing (metadata + default images from that printing)
  // Normalize IDs — Supabase/Scryfall UUIDs may differ by case across maps
  const prefId = art.preferred_scryfall_id
    ? String(art.preferred_scryfall_id).toLowerCase()
    : null;
  const baseId = String(base.scryfall_id).toLowerCase();
  const preferredMap = options.preferredPrintings;
  const preferredCard =
    prefId && preferredMap
      ? preferredMap.get(prefId) ||
        preferredMap.get(art.preferred_scryfall_id!) ||
        [...preferredMap.entries()].find(
          ([k]) => k.toLowerCase() === prefId
        )?.[1]
      : undefined;

  if (prefId && prefId !== baseId && preferredCard) {
    result = {
      ...mapScryfallToDeckApp(preferredCard),
      oracle_id: base.oracle_id || preferredCard.oracle_id || preferredCard.id,
    };
    hasPreferred = true;
  } else if (prefId && prefId !== baseId) {
    // Preference recorded but printing payload not loaded yet
    hasPreferred = true;
  }

  const frontUrl = art.custom_front_path
    ? `${options.publicStorageBase}/${art.custom_front_path}`
    : null;
  const backUrl = art.custom_back_path
    ? `${options.publicStorageBase}/${art.custom_back_path}`
    : null;

  if (frontUrl && result.faces[0]) {
    result.faces[0] = {
      ...result.faces[0],
      image_url: frontUrl,
      image_uris: null,
    };
    hasCustom = true;
  }
  if (backUrl && result.faces[1]) {
    result.faces[1] = {
      ...result.faces[1],
      image_url: backUrl,
      image_uris: null,
    };
    hasCustom = true;
  } else if (backUrl && result.faces.length === 1) {
    // User uploaded a "back" for a single-faced card — treat as second face overlay
    result.faces.push({
      name: `${result.name} (custom back)`,
      type_line: result.type_line,
      image_url: backUrl,
      image_uris: null,
    });
    hasCustom = true;
  }

  return {
    ...result,
    has_custom_art: hasCustom,
    has_preferred_printing: hasPreferred,
  };
}

/**
 * Map many Scryfall hits and apply a preference map keyed by oracle_id.
 */
export function mapScryfallListWithArt(
  cards: ScryfallCard[],
  artByOracleId: Map<string, UserCardArt>,
  options: ResolveArtOptions
): DeckAppCard[] {
  return cards.map((c) => {
    const base = mapScryfallToDeckApp(c);
    const art = artByOracleId.get(base.oracle_id.toLowerCase()) ?? artByOracleId.get(base.oracle_id);
    return applyUserCardArt(base, art, options);
  });
}
