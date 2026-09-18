export interface ScryfallImageUris {
  small?: string;
  normal?: string;
  large?: string;
  png?: string;
  art_crop?: string;
  border_crop?: string;
}

export interface ScryfallCardFace {
  object?: string;
  name: string;
  printed_name?: string;
  type_line: string;
  printed_type_line?: string;
  mana_cost?: string;
  oracle_text?: string;
  printed_text?: string;
  flavor_text?: string;
  artist?: string;
  artist_id?: string;
  illustration_id?: string;
  image_uris?: ScryfallImageUris | null;
  colors?: string[];
  color_indicator?: string[];
  power?: string;
  toughness?: string;
  loyalty?: string;
  defense?: string;
  watermark?: string;
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
  flavor_name?: string;
  artist?: string;
  artist_ids?: string[];
  illustration_id?: string;

  power?: string;
  toughness?: string;
  loyalty?: string;
  defense?: string;
  keywords?: string[];
  produced_mana?: string[];
  color_indicator?: string[];

  legalities?: Record<string, string>;
  games?: string[];
  reserved?: boolean;
  foil?: boolean;
  nonfoil?: boolean;
  finishes?: string[];
  oversized?: boolean;
  promo?: boolean;
  reprint?: boolean;
  variation?: boolean;
  digital?: boolean;
  border_color?: string;
  frame?: string;
  frame_effects?: string[];
  security_stamp?: string;
  full_art?: boolean;
  textless?: boolean;
  booster?: boolean;
  story_spotlight?: boolean;
  edhrec_rank?: number;
  penny_rank?: number;
  preview?: { source?: string; source_uri?: string; previewed_at?: string };
  prices?: {
    usd?: string | null;
    usd_foil?: string | null;
    usd_etched?: string | null;
    eur?: string | null;
    eur_foil?: string | null;
    tix?: string | null;
  };
  related_uris?: Record<string, string>;
  purchase_uris?: Record<string, string>;
  released_at?: string;
  watermark?: string;
  content_warning?: boolean;
  printed_name?: string;
  printed_text?: string;
  printed_type_line?: string;

  arena_id?: number;
  mtgo_id?: number;
  mtgo_foil_id?: number;
  tcgplayer_id?: number;
  cardmarket_id?: number;
  multiverse_ids?: number[];

  /** Scryfall page for this printing */
  scryfall_uri?: string;
  uri?: string;
  prints_search_uri?: string;
  rulings_uri?: string;
  /** Lang code, e.g. "en" */
  lang?: string;
}
