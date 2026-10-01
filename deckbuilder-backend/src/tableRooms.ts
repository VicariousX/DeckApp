import fs from "node:fs";
import path from "node:path";
import type { PlayAction, TableState } from "./wire.js";

export type RoomRecord = {
  id: string;
  hostSeat: string;
  state: TableState;
  actions: PlayAction[];
  updatedAt: number;
};

const DIR = process.env.TABLE_DIR || path.join(process.cwd(), "data", "tables");
const rooms = new Map<string, RoomRecord>();

function fileOf(id: string) {
  return path.join(DIR, `${id.replace(/[^a-zA-Z0-9_-]/g, "")}.json`);
}

function loadAll() {
  try {
    if (!fs.existsSync(DIR)) return;
    for (const name of fs.readdirSync(DIR)) {
      if (!name.endsWith(".json")) continue;
      const raw = fs.readFileSync(path.join(DIR, name), "utf8");
      const room = JSON.parse(raw) as RoomRecord;
      if (room?.id) rooms.set(room.id, room);
    }
  } catch (err) {
    console.error("[tables] load failed", err);
  }
}

function save(room: RoomRecord) {
  try {
    fs.mkdirSync(DIR, { recursive: true });
    fs.writeFileSync(fileOf(room.id), JSON.stringify(room));
  } catch (err) {
    console.error("[tables] save failed", err);
  }
}

loadAll();

export function getRoom(id: string): RoomRecord | undefined {
  return rooms.get(id);
}

export function putRoom(id: string, state: TableState, hostSeat: string): RoomRecord {
  const prev = rooms.get(id);
  const room: RoomRecord = {
    id,
    hostSeat: hostSeat || prev?.hostSeat || state.seats[0]?.id || "host",
    state,
    actions: prev?.actions ?? [],
    updatedAt: Date.now(),
  };
  rooms.set(id, room);
  save(room);
  return room;
}

export function appendAction(id: string, action: PlayAction, state: TableState): RoomRecord | undefined {
  const room = rooms.get(id);
  if (!room) return undefined;
  room.actions.push(action);
  if (room.actions.length > 400) room.actions = room.actions.slice(-400);
  room.state = state;
  room.updatedAt = Date.now();
  save(room);
  return room;
}
