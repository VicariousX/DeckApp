export type DeckBoard = "main" | "side" | "maybe" | "commander";

export type Deck = {
  id: string;
  user_id: string;
  name: string;
  description: string;
  format: string;
  is_public: boolean;
  created_at: string;
  updated_at: string;
};

export type DeckTag = {
  id: string;
  deck_id: string;
  name: string;
  color: string;
  created_at: string;
};

export type DeckCard = {
  id: string;
  deck_id: string;
  oracle_id: string;
  scryfall_id: string;
  name: string;
  type_line: string;
  mana_cost: string | null;
  cmc: number | null;
  quantity: number;
  board: DeckBoard;
  notes: string | null;
  created_at: string;
  updated_at: string;
  /** Populated when loading deck detail */
  tag_ids?: string[];
};

export type DeckDetail = {
  deck: Deck;
  cards: DeckCard[];
  tags: DeckTag[];
};

export type CreateDeckInput = {
  name: string;
  description?: string;
  format?: string;
  is_public?: boolean;
};

export type AddDeckCardInput = {
  oracle_id: string;
  scryfall_id: string;
  name: string;
  type_line: string;
  mana_cost?: string | null;
  cmc?: number | null;
  quantity?: number;
  board?: DeckBoard;
};
