import type { ScryfallImageUris } from "./scryfallCard";

/**
 * One face of a DeckApp card after resolution.
 * `image_url` is what the UI should render (Scryfall URI or custom upload URL).
 */
export type DeckAppCardFace = {
  name: string;
  type_line: string;
  mana_cost?: string;
  oracle_text?: string;
  artist?: string;
  /** Best single URL for this face (custom override wins over Scryfall). */
  image_url: string;
  /** Full Scryfall-style size map when available (null for pure custom uploads). */
  image_uris?: ScryfallImageUris | null;
};

/**
 * Internal DeckApp card model.
 *
 * - Identity & rules text come from Scryfall (or a cached copy).
 * - Images can be:
 *   1. Default Scryfall art for the printing
 *   2. Another Scryfall printing the user preferred
 *   3. A custom image the user uploaded (front and/or back)
 *
 * Used for on-site display and later deck export.
 */
export type DeckAppCard = {
  /** App-facing id: preferred_scryfall_id or base scryfall_id */
  id: string;
  /** Scryfall printing id this card is based on */
  scryfall_id: string;
  /** Logical card identity across printings (required for user art prefs) */
  oracle_id: string;
  name: string;
  type_line: string;
  mana_cost?: string;
  oracle_text?: string;
  cmc?: number;
  colors?: string[];
  color_identity?: string[];
  set: string;
  set_name: string;
  rarity: string;
  collector_number: string;
  layout: string;
  flavor_text?: string;
  artist?: string;
  scryfall_uri?: string;
  lang?: string;

  /** Always normalized to 1+ faces (single-faced cards get one face). */
  faces: DeckAppCardFace[];

  /** At least one face uses a user-uploaded image */
  has_custom_art: boolean;
  /** User pinned a different Scryfall printing than the base search hit */
  has_preferred_printing: boolean;
};

/**
 * Per-user art preference row (mirrors `public.user_card_art`).
 * Paths are storage object paths inside the `card-art` bucket.
 */
export type UserCardArt = {
  id: string;
  user_id: string;
  oracle_id: string;
  preferred_scryfall_id: string | null;
  custom_front_path: string | null;
  custom_back_path: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type UserCardArtUpsert = {
  oracle_id: string;
  preferred_scryfall_id?: string | null;
  custom_front_path?: string | null;
  custom_back_path?: string | null;
  notes?: string | null;
};
