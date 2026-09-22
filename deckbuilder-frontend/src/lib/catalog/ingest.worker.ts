/// <reference lib="webworker" />
import { trimCard, nameKey } from "./trim";

const DB_NAME = "deckapp-catalog";
const DB_VERSION = 1;
const CHUNK = 800;

type StartMsg = {
  type: "start";
  kind: "oracle-cards" | "default-cards" | "rulings";
  url: string;
  replaceCards: boolean;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("meta")) {
        db.createObjectStore("meta", { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains("cards")) {
        const cards = db.createObjectStore("cards", { keyPath: "id" });
        cards.createIndex("oracle_id", "oracle_id", { unique: false });
        cards.createIndex("name_lc", "name_lc", { unique: false });
      }
      if (!db.objectStoreNames.contains("rulings")) {
        const rulings = db.createObjectStore("rulings", {
          keyPath: "nid",
          autoIncrement: true,
        });
        rulings.createIndex("oracle_id", "oracle_id", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function putChunk(
  db: IDBDatabase,
  store: "cards" | "rulings",
  rows: unknown[]
): Promise<void> {
  if (rows.length === 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    const os = tx.objectStore(store);
    for (const row of rows) os.put(row);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function clearStore(db: IDBDatabase, store: "cards" | "rulings"): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function ingest(msg: StartMsg) {
  postMessage({ type: "progress", phase: "download", loaded: 0, total: 1, file: msg.kind });
  const res = await fetch(msg.url);
  if (!res.ok) throw new Error(`Download failed (${res.status})`);
  const text = await res.text();
  postMessage({ type: "progress", phase: "index", loaded: 0, total: 1, file: msg.kind });
  const parsed = JSON.parse(text) as unknown[];
  if (!Array.isArray(parsed)) throw new Error("Unexpected bulk format");

  const db = await openDb();
  try {
    if (msg.kind === "rulings") {
      await clearStore(db, "rulings");
      let buf: unknown[] = [];
      let n = 0;
      for (const row of parsed) {
        const r = row as Record<string, unknown>;
        buf.push({
          oracle_id: String(r.oracle_id ?? "").toLowerCase(),
          source: r.source,
          published_at: r.published_at,
          comment: r.comment,
          object: "ruling",
        });
        if (buf.length >= CHUNK) {
          await putChunk(db, "rulings", buf);
          n += buf.length;
          buf = [];
          postMessage({
            type: "progress",
            phase: "index",
            loaded: n,
            total: parsed.length,
            file: msg.kind,
          });
        }
      }
      await putChunk(db, "rulings", buf);
      n += buf.length;
      postMessage({ type: "done", kind: msg.kind, count: n });
      return;
    }

    if (msg.replaceCards) await clearStore(db, "cards");
    let buf: unknown[] = [];
    let n = 0;
    for (const row of parsed) {
      const raw = row as Record<string, unknown>;
      const trimmed = trimCard(raw);
      const id = String(trimmed.id ?? "").toLowerCase();
      if (!id) continue;
      buf.push({
        ...trimmed,
        id,
        oracle_id: String(trimmed.oracle_id ?? id).toLowerCase(),
        name_lc: nameKey(trimmed.name),
      });
      if (buf.length >= CHUNK) {
        await putChunk(db, "cards", buf);
        n += buf.length;
        buf = [];
        postMessage({
          type: "progress",
          phase: "index",
          loaded: n,
          total: parsed.length,
          file: msg.kind,
        });
      }
    }
    await putChunk(db, "cards", buf);
    n += buf.length;
    postMessage({ type: "done", kind: msg.kind, count: n });
  } finally {
    db.close();
  }
}

self.onmessage = (ev: MessageEvent<StartMsg>) => {
  const msg = ev.data;
  if (!msg || msg.type !== "start") return;
  void ingest(msg).catch((err: unknown) => {
    postMessage({
      type: "error",
      message: err instanceof Error ? err.message : String(err),
    });
  });
};
