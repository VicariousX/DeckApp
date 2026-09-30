export type PlayZone =
  | "library"
  | "hand"
  | "battlefield"
  | "graveyard"
  | "exile"
  | "command"
  | "sideboard"
  | "stack";

export type PlayCard = {
  instanceId: string;
  oracleId: string;
  scryfallId: string;
  name: string;
  typeLine: string;
  manaCost: string;
  cmc?: number;
  image?: string;
  imageBack?: string;
  face: 0 | 1;
  tapped: boolean;
  facedown: boolean;
  counters: Record<string, number>;
  attachedTo?: string;
  token: boolean;
  ownerSeat: string;
  x?: number;
  y?: number;
  row?: "field" | "lands";
  enteredTurn?: number;
};

export type SeatState = {
  id: string;
  userId?: string;
  name: string;
  life: number;
  poison: number;
  energy: number;
  experience: number;
  commanderTax: number;
  commanderDamage: Record<string, number>;
  zones: Record<PlayZone, PlayCard[]>;
  mulligans: number;
  maxHand: number;
};

export type TableState = {
  id: string;
  deckId?: string;
  deckName: string;
  format: string;
  seed: number;
  rngStep: number;
  turn: number;
  activeSeat: string;
  seats: SeatState[];
  log: { at: number; text: string }[];
  started: boolean;
  libraryReveal: Record<string, "hidden" | "self" | "all">;
  keptHand?: Record<string, boolean>;
};

export type PlayAction =
  | { type: "hydrate"; state: TableState }
  | { type: "shuffle"; seatId: string }
  | { type: "draw"; seatId: string; n?: number }
  | { type: "mulligan"; seatId: string; kind?: "london" | "paris" | "free" }
  | { type: "keep"; seatId: string }
  | { type: "move"; seatId: string; instanceId: string; to: PlayZone; index?: number }
  | { type: "moveMany"; seatId: string; instanceIds: string[]; to: PlayZone; index?: number }
  | { type: "tap"; instanceId: string; tapped?: boolean }
  | { type: "tapMany"; instanceIds: string[]; tapped?: boolean }
  | { type: "flip"; instanceId: string; face?: 0 | 1 }
  | { type: "facedown"; instanceId: string; facedown?: boolean }
  | { type: "counter"; instanceId: string; key: string; delta: number }
  | { type: "counterMany"; instanceIds: string[]; key: string; delta: number }
  | { type: "proliferate"; seatId: string }
  | { type: "life"; seatId: string; delta: number }
  | { type: "stat"; seatId: string; key: "poison" | "energy" | "experience"; delta: number }
  | { type: "tax"; seatId: string; delta: number }
  | { type: "cmdDamage"; seatId: string; from: string; delta: number }
  | { type: "nextTurn"; untap?: boolean; draw?: number }
  | { type: "scry"; seatId: string; keepTop: string[]; bottom: string[]; grave?: string[] }
  | { type: "bottomRandom"; seatId: string; instanceIds: string[] }
  | { type: "mill"; seatId: string; n: number }
  | { type: "untapAll"; seatId: string }
  | { type: "addToken"; seatId: string; card: Omit<PlayCard, "instanceId" | "ownerSeat"> }
  | { type: "remove"; instanceId: string }
  | { type: "removeMany"; instanceIds: string[] }
  | { type: "clone"; instanceId: string }
  | { type: "cloneMany"; instanceIds: string[] }
  | { type: "stackDelta"; instanceId: string; delta: number }
  | { type: "attach"; instanceIds: string[]; to: string | null }
  | { type: "exileTop"; seatId: string; n: number }
  | { type: "revealTop"; seatId: string; mode: "hidden" | "self" | "all" }
  | { type: "align"; instanceIds: string[] }
  | {
      type: "place";
      instanceId: string;
      x?: number;
      y?: number;
      row?: "field" | "lands";
    }
  | { type: "log"; text: string };
