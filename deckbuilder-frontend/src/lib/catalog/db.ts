import type { CatalogMeta } from "./types";
import type { ScryfallCard } from "../../types/scryfallCard";

type LocalRuling = {
  object?: string;
  oracle_id?: string;
  source?: string;
  published_at?: string;
  comment: string;
};

const DB_NAME = "deckapp-catalog";
const DB_VERSION = 1;

export function openCatalogDb(): Promise<IDBDatabase> {
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

export async function readMeta(): Promise<CatalogMeta | null> {
  const db = await openCatalogDb();
  try {
    return await new Promise((resolve, reject) => {
      const req = db.transaction("meta").objectStore("meta").get("catalog");
      req.onsuccess = () => resolve((req.result as CatalogMeta) ?? null);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

export async function writeMeta(meta: CatalogMeta): Promise<void> {
  const db = await openCatalogDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("meta", "readwrite");
      tx.objectStore("meta").put({ ...meta, key: "catalog" });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export async function clearCatalog(): Promise<void> {
  const db = await openCatalogDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(["meta", "cards", "rulings"], "readwrite");
      tx.objectStore("meta").clear();
      tx.objectStore("cards").clear();
      tx.objectStore("rulings").clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export async function getCardById(id: string): Promise<ScryfallCard | null> {
  const db = await openCatalogDb();
  try {
    return await new Promise((resolve, reject) => {
      const req = db
        .transaction("cards")
        .objectStore("cards")
        .get(id.toLowerCase());
      req.onsuccess = () => resolve((req.result as ScryfallCard) ?? null);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

export async function getCardByName(name: string): Promise<ScryfallCard | null> {
  const key = name.trim().toLowerCase();
  if (!key) return null;
  const db = await openCatalogDb();
  try {
    return await new Promise((resolve, reject) => {
      const idx = db
        .transaction("cards")
        .objectStore("cards")
        .index("name_lc");
      const req = idx.get(key);
      req.onsuccess = () => resolve((req.result as ScryfallCard) ?? null);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

export async function getPrintsByOracle(
  oracleId: string
): Promise<ScryfallCard[]> {
  const key = oracleId.toLowerCase();
  const db = await openCatalogDb();
  try {
    return await new Promise((resolve, reject) => {
      const idx = db
        .transaction("cards")
        .objectStore("cards")
        .index("oracle_id");
      const req = idx.getAll(key);
      req.onsuccess = () => resolve((req.result as ScryfallCard[]) ?? []);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

export async function autocompleteLocal(
  q: string,
  limit = 20
): Promise<string[]> {
  const prefix = q.trim().toLowerCase();
  if (prefix.length < 2) return [];
  const db = await openCatalogDb();
  try {
    return await new Promise((resolve, reject) => {
      const idx = db
        .transaction("cards")
        .objectStore("cards")
        .index("name_lc");
      const range = IDBKeyRange.bound(prefix, prefix + "\uffff");
      const req = idx.openCursor(range);
      const names: string[] = [];
      const seen = new Set<string>();
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor || names.length >= limit) {
          resolve(names);
          return;
        }
        const row = cursor.value as { name?: string; name_lc?: string };
        const label = row.name || row.name_lc || "";
        if (label && !seen.has(label)) {
          seen.add(label);
          names.push(label);
        }
        cursor.continue();
      };
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

export async function getRulingsByOracle(
  oracleId: string
): Promise<LocalRuling[]> {
  const key = oracleId.toLowerCase();
  const db = await openCatalogDb();
  try {
    return await new Promise((resolve, reject) => {
      const idx = db
        .transaction("rulings")
        .objectStore("rulings")
        .index("oracle_id");
      const req = idx.getAll(key);
      req.onsuccess = () => {
        const rows = (req.result as LocalRuling[]) ?? [];
        resolve(rows);
      };
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

let readyCache: boolean | null = null;

export async function catalogReady(): Promise<boolean> {
  if (readyCache != null) return readyCache;
  const meta = await readMeta();
  readyCache = Boolean(meta && meta.card_count > 0);
  return readyCache;
}

export function setCatalogReadyCache(ready: boolean): void {
  readyCache = ready;
}
