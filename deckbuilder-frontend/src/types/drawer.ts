/** User-scoped reusable card group (not deck tags). */
export type Drawer = {
  id: string;
  user_id: string;
  name: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
  /** Present when list query includes a count aggregate. */
  card_count?: number;
};

export type DrawerCard = {
  id: string;
  drawer_id: string;
  oracle_id: string;
  sort_order: number;
  created_at: string;
};

/** Drawer card joined with user_cards display fields for UI. */
export type DrawerCardView = DrawerCard & {
  name: string;
  type_line: string;
  mana_cost: string | null;
  cmc: number | null;
  color_identity: string[];
  oracle_text: string | null;
  image_url: string | null;
  scryfall_id: string | null;
};

export const DEFAULT_DRAWER_NAMES = ["Land", "Ramp", "Draw"] as const;
