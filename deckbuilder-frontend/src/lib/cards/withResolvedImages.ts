import type { DeckAppCard } from "../../types/deckAppCard";
import type { ScryfallCard } from "../../types/scryfallCard";

/**
 * Overlay resolved DeckApp image URLs onto a ScryfallCard-shaped object so
 * existing CardImage / CardDetail consumers keep working unchanged.
 */
export function withResolvedImages(
  base: ScryfallCard,
  resolved: DeckAppCard | null | undefined
): ScryfallCard {
  if (!resolved) return base;
  if (!resolved.has_custom_art && !resolved.has_preferred_printing) {
    return base;
  }

  const frontUrl = resolved.faces[0]?.image_url || "";
  const backUrl = resolved.faces[1]?.image_url || "";
  // Preference recorded but preferred printing not loaded yet — keep base art
  if (!frontUrl && !resolved.has_custom_art) {
    return base;
  }

  const next: ScryfallCard = {
    ...base,
    id: resolved.scryfall_id || base.id,
    oracle_id: resolved.oracle_id || base.oracle_id,
    name: resolved.name,
    type_line: resolved.type_line,
    set: resolved.set,
    set_name: resolved.set_name,
    rarity: resolved.rarity,
    collector_number: resolved.collector_number,
    artist: resolved.artist,
  };

  if (base.card_faces && base.card_faces.length > 1) {
    next.card_faces = base.card_faces.map((face, i) => {
      const url = resolved.faces[i]?.image_url;
      return {
        ...face,
        name: resolved.faces[i]?.name ?? face.name,
        image_uris: url
          ? {
              normal: url,
              large: url,
              small: url,
              art_crop: url,
            }
          : face.image_uris,
      };
    });
    next.image_uris = null;
  } else if (frontUrl) {
    next.image_uris = {
      normal: frontUrl,
      large: frontUrl,
      small: frontUrl,
      art_crop: frontUrl,
    };
    if (backUrl && resolved.faces.length > 1) {
      next.card_faces = [
        {
          name: resolved.faces[0]?.name ?? base.name,
          type_line: resolved.faces[0]?.type_line ?? base.type_line,
          mana_cost: resolved.faces[0]?.mana_cost ?? base.mana_cost,
          oracle_text: resolved.faces[0]?.oracle_text ?? base.oracle_text,
          artist: resolved.faces[0]?.artist,
          image_uris: {
            normal: frontUrl,
            large: frontUrl,
            small: frontUrl,
            art_crop: frontUrl,
          },
        },
        {
          name: resolved.faces[1]?.name ?? "Custom back",
          type_line: resolved.faces[1]?.type_line ?? base.type_line,
          image_uris: {
            normal: backUrl,
            large: backUrl,
            small: backUrl,
            art_crop: backUrl,
          },
        },
      ];
      next.image_uris = null;
    }
  }

  return next;
}
