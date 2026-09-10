export interface ScryfallImageUris {
  small?: string;
  normal?: string;
  large?: string;
  png?: string;
  art_crop?: string;
  border_crop?: string;
}

export interface ScryfallCardFace {
  name: string;
  type_line: string;
  mana_cost?: string;
  oracle_text?: string;
  artist?: string;
  image_uris?: ScryfallImageUris | null;
}

/**
 * Subset of Scryfall's card object used by the app.
 * Field names match the API so search responses map 1:1.
 */
export interface ScryfallCard {
  id: string;
  /** Stable identity across printings / languages for the same oracle card. */
  oracle_id?: string;
  name: string;
  type_line: string;
  oracle_text?: string;
  mana_cost?: string;
  cmc?: number;

  colors?: string[];
  color_identity?: string[];

  image_uris?: ScryfallImageUris | null;
  card_faces?: ScryfallCardFace[];

  set: string;
  set_name: string;
  rarity: string;
  collector_number: string;
  layout: string;

  flavor_text?: string;
  artist?: string;

  /** Scryfall page for this printing */
  scryfall_uri?: string;
  /** Lang code, e.g. "en" */
  lang?: string;
}
