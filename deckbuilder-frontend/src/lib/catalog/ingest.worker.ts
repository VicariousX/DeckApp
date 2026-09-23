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

async function* iterateRows(res: Response): AsyncGenerator<unknown> {
  const raw = new Uint8Array(await res.arrayBuffer());
  const gzip = raw.length >= 2 && raw[0] === 0x1f && raw[1] === 0x8b;
  let stream: ReadableStream<Uint8Array> = new Blob([raw]).stream();
  if (gzip) {
    stream = stream.pipeThrough(new DecompressionStream("gzip"));
  }
  const reader = stream.pipeThrough(new TextDecoderStream()).getReader();
  let carry = "";
  let first = true;
  let jsonArray = false;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (first) {
      first = false;
      const peek = (carry + value).trimStart();
      jsonArray = peek.startsWith("[");
    }
    carry += value;
    if (jsonArray) continue;
    const lines = carry.split("\n");
    carry = lines.pop() ?? "";
    for (const line of lines) {
      const t = line.trim();
      if (t) yield JSON.parse(t);
    }
  }
  if (jsonArray) {
    const arr = JSON.parse(carry) as unknown;
    if (!Array.isArray(arr)) throw new Error("Unexpected bulk format");
    for (const row of arr) yield row;
    return;
  }
  const last = carry.trim();
  if (last) yield JSON.parse(last);
}

async function ingest(msg: StartMsg) {
  postMessage({
    type: "progress",
    phase: "download",
    loaded: 0,
    total: 1,
    file: msg.kind,
  });
  const res = await fetch(msg.url);
  if (!res.ok) throw new Error(`Download failed (${res.status})`);
  postMessage({
    type: "progress",
    phase: "index",
    loaded: 0,
    total: 0,
    file: msg.kind,
  });

  const db = await openDb();
  try {
    if (msg.kind === "rulings") await clearStore(db, "rulings");
    else if (msg.replaceCards) await clearStore(db, "cards");

    const store = msg.kind === "rulings" ? "rulings" : "cards";
    let buf: unknown[] = [];
    let n = 0;

    const flush = async () => {
      if (!buf.length) return;
      try {
        await putChunk(db, store, buf);
      } catch (err) {
        const name = err instanceof DOMException ? err.name : "";
        if (name === "QuotaExceededError") {
          throw new Error(
            "This device does not have enough browser storage for all printings. Use Unique cards + rulings instead."
          );
        }
        throw err;
      }
      n += buf.length;
      buf = [];
      postMessage({
        type: "progress",
        phase: "index",
        loaded: n,
        total: Math.max(n, 1),
        file: msg.kind,
      });
    };

    for await (const row of iterateRows(res)) {
      const r = row as Record<string, unknown>;
      if (msg.kind === "rulings") {
        buf.push({
          oracle_id: String(r.oracle_id ?? "").toLowerCase(),
          source: r.source,
          published_at: r.published_at,
          comment: r.comment,
          object: "ruling",
        });
      } else {
        const trimmed = trimCard(r);
        const id = String(trimmed.id ?? "").toLowerCase();
        if (!id) continue;
        buf.push({
          ...trimmed,
          id,
          oracle_id: String(trimmed.oracle_id ?? id).toLowerCase(),
          name_lc: nameKey(trimmed.name),
        });
      }
      if (buf.length >= CHUNK) await flush();
    }
    await flush();
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
