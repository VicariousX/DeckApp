import { GRID, ZONES } from "../layout/siteMap";

export type SkySide = "desktop" | "mobile";
export type SkyNode = { x: number; y: number };

const KEY = "deckapp-sky-plot";
const DB = "deckapp-sky";
const STORE = "images";

function defaults(): Record<string, SkyNode> {
  const nodes: Record<string, SkyNode> = {};
  for (const zone of Object.values(ZONES)) {
    nodes[zone.id] = {
      x: (zone.col + 0.5) / GRID.cols,
      y: (zone.row + 0.5) / GRID.rows,
    };
  }
  return nodes;
}

type Saved = Partial<Record<SkySide, Record<string, SkyNode>>>;

function readSaved(): Saved {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Saved;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function skySide(): SkySide {
  if (typeof window === "undefined") return "desktop";
  return window.matchMedia("(orientation: portrait)").matches ? "mobile" : "desktop";
}

export function nodesFor(side: SkySide): Record<string, SkyNode> {
  const saved = readSaved()[side] ?? {};
  const nodes = defaults();
  for (const id of Object.keys(nodes)) {
    const node = saved[id];
    if (!node || typeof node.x !== "number" || typeof node.y !== "number") continue;
    nodes[id] = {
      x: Math.min(0.98, Math.max(0.02, node.x)),
      y: Math.min(0.98, Math.max(0.02, node.y)),
    };
  }
  return nodes;
}

export function focusOf(id: string, side: SkySide = skySide()) {
  const node = nodesFor(side)[id] ?? { x: 0.5, y: 0.5 };
  return {
    x: node.x,
    y: node.y,
    col: node.x * GRID.cols - 0.5,
    row: node.y * GRID.rows - 0.5,
  };
}

function write(side: SkySide, nodes: Record<string, SkyNode>) {
  const saved = readSaved();
  saved[side] = nodes;
  localStorage.setItem(KEY, JSON.stringify(saved));
  window.dispatchEvent(new Event("deckapp-sky"));
}

export function moveNode(side: SkySide, id: string, x: number, y: number) {
  const nodes = nodesFor(side);
  nodes[id] = {
    x: Math.min(0.98, Math.max(0.02, x)),
    y: Math.min(0.98, Math.max(0.02, y)),
  };
  write(side, nodes);
}

export function resetNodes(side: SkySide) {
  write(side, defaults());
}

export function subscribeSky(onChange: () => void) {
  window.addEventListener("deckapp-sky", onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener("deckapp-sky", onChange);
    window.removeEventListener("storage", onChange);
  };
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function skyImageUrl(side: SkySide): Promise<string | null> {
  try {
    const db = await openDb();
    const blob = await new Promise<Blob | null>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(side);
      req.onsuccess = () => resolve((req.result as Blob | undefined) ?? null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return blob ? URL.createObjectURL(blob) : null;
  } catch {
    return null;
  }
}

export async function setSkyImage(side: SkySide, file: Blob) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(file, side);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
  window.dispatchEvent(new Event("deckapp-sky"));
}

export async function clearSkyImage(side: SkySide) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(side);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
  window.dispatchEvent(new Event("deckapp-sky"));
}
