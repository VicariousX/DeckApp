export interface ScryfallCardFace {
  name: string;
  type_line: string;
  mana_cost?: string;
  oracle_text?: string;
  artist?: string;
  image_uris?: {
    small?: string;
    normal?: string;
    large?: string;
    png?: string;
    art_crop?: string;
    border_crop?: string;
  } | null;
}

export interface ScryfallCard {
  id: string;
  name: string;
  type_line: string;
  oracle_text?: string;
  mana_cost?: string;
  cmc?: number;

  colors?: string[];
  color_identity?: string[];

  image_uris?: {
    small?: string;
    normal?: string;
    large?: string;
    png?: string;
    art_crop?: string;
    border_crop?: string;
  } | null;

  card_faces?: ScryfallCardFace[];

  set: string;
  set_name: string;
  rarity: string;
  collector_number: string;
  layout: string;

  flavor_text?: string;
  artist?: string;
}
