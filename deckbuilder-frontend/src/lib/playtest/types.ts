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
  image?: string;
  imageBack?: string;
  face: 0 | 1;
  tapped: boolean;
  facedown: boolean;
  counters: Record<string, number>;
  attachedTo?: string;
  token: boolean;
  ownerSeat: string;
};

export type SeatState = {
  id: string;
  userId?: string;
  name: string;
  life: number;
  poison: number;
  energy: number;
  experience: number;
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
  turn: number;
  activeSeat: string;
  seats: SeatState[];
  log: { at: number; text: string }[];
  started: boolean;
};

export type PlayAction =
  | { type: "hydrate"; state: TableState }
  | { type: "shuffle"; seatId: string }
  | { type: "draw"; seatId: string; n?: number }
  | { type: "mulligan"; seatId: string; kind?: "london" | "paris" | "free" }
  | { type: "keep"; seatId: string }
  | { type: "move"; seatId: string; instanceId: string; to: PlayZone; index?: number }
  | { type: "tap"; instanceId: string; tapped?: boolean }
  | { type: "flip"; instanceId: string }
  | { type: "facedown"; instanceId: string }
  | { type: "counter"; instanceId: string; key: string; delta: number }
  | { type: "life"; seatId: string; delta: number }
  | { type: "stat"; seatId: string; key: "poison" | "energy" | "experience"; delta: number }
  | { type: "nextTurn"; untap?: boolean; draw?: number }
  | { type: "scry"; seatId: string; keepTop: string[]; bottom: string[] }
  | { type: "mill"; seatId: string; n: number }
  | { type: "untapAll"; seatId: string }
  | { type: "addToken"; seatId: string; card: Omit<PlayCard, "instanceId" | "ownerSeat"> }
  | { type: "log"; text: string };
