import type { PlayAction, TableState } from "./types";

/**
 * Multiplayer path: every mutation is a PlayAction.
 * v1 uses BroadcastChannel (same-browser tabs) as a stand-in for a
 * WebSocket room. Next step: POST actions to a table room and echo
 * them to seats. Do not apply remote hydrate except for the host snapshot.
 */
export type TableWire =
  | { kind: "action"; action: PlayAction; from: string }
  | { kind: "snapshot"; state: TableState; from: string };

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
