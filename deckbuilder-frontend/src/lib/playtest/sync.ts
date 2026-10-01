import { apiUrl, tableSocketUrl } from "../apiBase";
import type { PlayAction, PlayCard, TableState } from "./types";

/**
 * Same-browser stand-in for a table room. The host applies intents.
 * Guests receive the action and can reconnect from a snapshot.
 */
export type TableWire =
  | { kind: "join"; from: string; name: string }
  | { kind: "welcome"; seatId: string; state: TableState; from: string }
  | { kind: "intent"; action: PlayAction; from: string }
  | { kind: "action"; action: PlayAction; from: string; state?: TableState }
  | { kind: "snapshot"; state: TableState; from: string }
  | { kind: "reject"; text: string; from: string };

const TURN_BOUND = new Set(["nextTurn", "draw", "untapAll", "pass"]);

function find(state: TableState, instanceId: string): PlayCard | null {
  for (const seat of state.seats) {
    for (const zone of Object.values(seat.zones)) {
      const card = zone.find((c) => c.instanceId === instanceId);
      if (card) return card;
    }
  }
  return null;
}

export function acceptIntent(state: TableState, action: PlayAction, seatId: string): string | null {
  if (TURN_BOUND.has(action.type) && state.activeSeat && state.activeSeat !== seatId) {
    return "Not your turn";
  }
  const instanceId = "instanceId" in action ? String(action.instanceId) : "";
  if (instanceId) {
    const card = find(state, instanceId);
    if (card && card.controllerSeat && card.controllerSeat !== seatId && card.ownerSeat !== seatId) {
      return "That card is controlled by another seat";
    }
  }
  return null;
}

export function openLocalTableChannel(
  tableId: string,
  onMessage: (msg: TableWire) => void
): { send: (msg: TableWire) => void; close: () => void } {
  const ch = new BroadcastChannel(`deckapp.table.${tableId}`);
  ch.onmessage = (e) => onMessage(e.data as TableWire);
  return {
    send: (msg) => ch.postMessage(msg),
    close: () => ch.close(),
  };
}

export function openHostedTable(
  room: string,
  role: "host" | "guest",
  name: string,
  onMessage: (msg: TableWire) => void
): { send: (msg: TableWire) => void; close: () => void } {
  const ws = new WebSocket(tableSocketUrl(room, role, name));
  ws.onmessage = (e) => {
    try {
      onMessage(JSON.parse(String(e.data)) as TableWire);
    } catch {
      /* ignore */
    }
  };
  return {
    send: (msg) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
      else ws.addEventListener("open", () => ws.send(JSON.stringify(msg)), { once: true });
    },
    close: () => ws.close(),
  };
}

export async function publishTable(room: string, state: TableState, hostSeat: string) {
  await fetch(apiUrl(`/api/tables/${encodeURIComponent(room)}`), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ state, hostSeat }),
  });
}
