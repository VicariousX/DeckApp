/** Shared wire types. Kept local so the server does not import the frontend. */
export type PlayAction = { type: string; [key: string]: unknown };

export type TableState = {
  id: string;
  seats: { id: string; name: string }[];
  [key: string]: unknown;
};

export type TableWire =
  | { kind: "join"; from: string; name: string }
  | { kind: "welcome"; seatId: string; state: TableState; from: string }
  | { kind: "intent"; action: PlayAction; from: string }
  | { kind: "action"; action: PlayAction; from: string; state?: TableState }
  | { kind: "snapshot"; state: TableState; from: string }
  | { kind: "reject"; text: string; from: string };
