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
  oracle_text?: string;
  mana_cost?: string;
  colors?: string[];
  image_uris?: ScryfallImageUris;
}

export interface ScryfallCardBase {
  id: string;
  name: string;
  type_line: string;
  oracle_text?: string;
  mana_cost?: string;
  cmc?: number;
  colors?: string[];
  color_identity?: string[];
  set: string;
  set_name: string;
  rarity: string;
  collector_number: string;
  layout: string;
}

/**
 * Normal cards (non-double-faced)
 */
export interface ScryfallSingleCard extends ScryfallCardBase {
  image_uris: ScryfallImageUris;
  card_faces?: undefined;
}

/**
 * Double-faced / multi-faced cards
 */
export interface ScryfallMultiCard extends ScryfallCardBase {
  card_faces: ScryfallCardFace[];
  image_uris?: undefined;
}

/**
 * Union type for all Scryfall cards
 */
export type ScryfallCard = ScryfallSingleCard | ScryfallMultiCard;

export interface ScryfallSearchResponse {
  object: "list";
  total_cards: number;
  has_more: boolean;
  data: ScryfallCard[];
}
