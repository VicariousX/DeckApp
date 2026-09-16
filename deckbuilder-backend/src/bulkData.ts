/**
 * Local Scryfall bulk-data index.
 *
 * Downloads default_cards (all English printings) from data.scryfall.io (not
 * rate-limited like api.scryfall.com) and serves card / print / name lookups
 * without hitting the live API.
 *
 * Card images in bulk objects already point at cards.scryfall.io — we never
 * store image binaries; the CDN is unlimited for reasonable use.
 */

import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { createGunzip } from "node:zlib";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "../data");
const META_PATH = path.join(DATA_DIR, "bulk-meta.json");
const JSONL_PATH = path.join(DATA_DIR, "default-cards.jsonl");

const SCRYFALL_HEADERS: Record<string, string> = {
  "User-Agent": "DeckApp/1.0 (https://github.com/VicariousX/DeckApp; bulk sync)",
  Accept: "application/json",
};

/** Minimal card shape we keep (full Scryfall card JSON from bulk). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type BulkCard = Record<string, any>;

type BulkMeta = {
  type: string;
  updated_at: string;
  jsonl_download_uri: string;
  downloaded_at: string;
  card_count: number;
};

type BulkState = {
  ready: boolean;
  loading: Promise<void> | null;
  meta: BulkMeta | null;
  byId: Map<string, BulkCard>;
  byOracle: Map<string, BulkCard[]>;
  /** lowercase exact name → representative card (prefer non-digital, newest) */
  byName: Map<string, BulkCard>;
  /** sorted unique names for autocomplete */
  names: string[];
};

const state: BulkState = {
  ready: false,
  loading: null,
  meta: null,
  byId: new Map(),
  byOracle: new Map(),
  byName: new Map(),
  names: [],
};

function norm(s: string): string {
  return s.trim().toLowerCase();
}

async function ensureDataDir(): Promise<void> {
  await fsp.mkdir(DATA_DIR, { recursive: true });
}

async function fetchBulkMeta(): Promise<{
  updated_at: string;
  jsonl_download_uri: string;
}> {
  // bulk-data type endpoint — one request, then file comes from data.scryfall.io
  const res = await fetch("https://api.scryfall.com/bulk-data/default-cards", {
    headers: SCRYFALL_HEADERS,
  });
  if (!res.ok) {
    throw new Error(`bulk-data metadata failed: ${res.status}`);
  }
  const data = (await res.json()) as {
    updated_at: string;
    jsonl_download_uri?: string;
    download_uri?: string;
  };
  const uri = data.jsonl_download_uri || data.download_uri;
  if (!uri) throw new Error("No download URI in bulk-data response");
  return { updated_at: data.updated_at, jsonl_download_uri: uri };
}

async function downloadJsonl(uri: string): Promise<void> {
  await ensureDataDir();
  const res = await fetch(uri, { headers: SCRYFALL_HEADERS });
  if (!res.ok || !res.body) {
    throw new Error(`bulk download failed: ${res.status}`);
  }

  const tmp = JSONL_PATH + ".tmp";
  const out = fs.createWriteStream(tmp);

  // data.scryfall.io serves .jsonl.gz — gunzip while writing plain jsonl
  const isGz = uri.endsWith(".gz") || uri.includes(".jsonl.gz");
  // Node fetch body as web stream → convert
  const nodeStream = (await import("node:stream")).Readable.fromWeb(
    res.body as import("node:stream/web").ReadableStream
  );

  await new Promise<void>((resolve, reject) => {
    const pipeline = isGz ? nodeStream.pipe(createGunzip()) : nodeStream;
    pipeline.pipe(out);
    out.on("finish", () => resolve());
    out.on("error", reject);
    pipeline.on("error", reject);
  });

  await fsp.rename(tmp, JSONL_PATH);
}

function preferCard(a: BulkCard, b: BulkCard): BulkCard {
  // Prefer paper over digital; then newer release
  const aDig = a.digital ? 1 : 0;
  const bDig = b.digital ? 1 : 0;
  if (aDig !== bDig) return aDig < bDig ? a : b;
  const aDate = String(a.released_at ?? "");
  const bDate = String(b.released_at ?? "");
  return aDate >= bDate ? a : b;
}

async function indexJsonl(): Promise<number> {
  state.byId = new Map();
  state.byOracle = new Map();
  state.byName = new Map();

  const rl = createInterface({
    input: fs.createReadStream(JSONL_PATH, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });

  let count = 0;
  for await (const line of rl) {
    if (!line.trim()) continue;
    let card: BulkCard;
    try {
      card = JSON.parse(line) as BulkCard;
    } catch {
      continue;
    }
    if (!card?.id) continue;
    count++;

    const id = norm(String(card.id));
    state.byId.set(id, card);

    const oracle = card.oracle_id ? norm(String(card.oracle_id)) : "";
    if (oracle) {
      const list = state.byOracle.get(oracle) ?? [];
      list.push(card);
      state.byOracle.set(oracle, list);
    }

    const nameKey = norm(String(card.name ?? ""));
    if (nameKey) {
      const prev = state.byName.get(nameKey);
      state.byName.set(nameKey, prev ? preferCard(prev, card) : card);
    }
    // Index front face name for DFCs
    const face0 = card.card_faces?.[0]?.name;
    if (face0) {
      const fk = norm(String(face0));
      if (fk && fk !== nameKey) {
        const prev = state.byName.get(fk);
        state.byName.set(fk, prev ? preferCard(prev, card) : card);
      }
    }
  }

  // Sort printings newest-first per oracle
  for (const [oid, list] of state.byOracle) {
    list.sort((a, b) =>
      String(b.released_at ?? "").localeCompare(String(a.released_at ?? ""))
    );
    state.byOracle.set(oid, list);
  }

  state.names = [...state.byName.keys()].sort((a, b) => a.localeCompare(b));
  state.ready = true;
  return count;
}

async function loadFromDiskIfPresent(): Promise<boolean> {
  try {
    await fsp.access(JSONL_PATH);
    const count = await indexJsonl();
    try {
      const raw = await fsp.readFile(META_PATH, "utf8");
      state.meta = JSON.parse(raw) as BulkMeta;
      state.meta.card_count = count;
    } catch {
      state.meta = {
        type: "default_cards",
        updated_at: "",
        jsonl_download_uri: "",
        downloaded_at: new Date().toISOString(),
        card_count: count,
      };
    }
    console.log(`[bulk] loaded ${count} cards from disk`);
    return true;
  } catch {
    return false;
  }
}

/**
 * Ensure bulk data is present. Downloads only when missing or outdated
 * (upstream updated_at changed). Safe to call concurrently.
 */
export async function ensureBulkData(options?: {
  force?: boolean;
}): Promise<void> {
  if (state.ready && !options?.force) return;
  if (state.loading) return state.loading;

  state.loading = (async () => {
    await ensureDataDir();

    if (!options?.force) {
      const ok = await loadFromDiskIfPresent();
      if (ok) {
        // Background freshness check (does not block)
        void refreshIfStale().catch((e) =>
          console.warn("[bulk] background refresh failed:", e)
        );
        return;
      }
    }

    console.log("[bulk] downloading default_cards from Scryfall…");
    const meta = await fetchBulkMeta();
    await downloadJsonl(meta.jsonl_download_uri);
    const count = await indexJsonl();
    state.meta = {
      type: "default_cards",
      updated_at: meta.updated_at,
      jsonl_download_uri: meta.jsonl_download_uri,
      downloaded_at: new Date().toISOString(),
      card_count: count,
    };
    await fsp.writeFile(META_PATH, JSON.stringify(state.meta, null, 2));
    console.log(`[bulk] indexed ${count} cards (updated ${meta.updated_at})`);
  })().finally(() => {
    state.loading = null;
  });

  return state.loading;
}

async function refreshIfStale(): Promise<void> {
  if (!state.meta?.updated_at) return;
  const meta = await fetchBulkMeta();
  if (meta.updated_at === state.meta.updated_at) return;
  console.log("[bulk] newer default_cards available — refreshing");
  await ensureBulkData({ force: true });
}

export function bulkStatus(): {
  ready: boolean;
  card_count: number;
  updated_at: string | null;
  downloaded_at: string | null;
} {
  return {
    ready: state.ready,
    card_count: state.meta?.card_count ?? state.byId.size,
    updated_at: state.meta?.updated_at ?? null,
    downloaded_at: state.meta?.downloaded_at ?? null,
  };
}

export function getCardById(id: string): BulkCard | null {
  if (!state.ready) return null;
  return state.byId.get(norm(id)) ?? null;
}

export function getPrintsByOracleId(oracleId: string): BulkCard[] {
  if (!state.ready) return [];
  return state.byOracle.get(norm(oracleId)) ?? [];
}

export function getCardByName(name: string): BulkCard | null {
  if (!state.ready) return null;
  return state.byName.get(norm(name)) ?? null;
}

/** One unique-name representative chosen at random from the local bulk index. */
export type BulkRuling = {
  object?: string;
  oracle_id: string;
  source?: string;
  published_at?: string;
  comment: string;
};

const RULINGS_META_PATH = path.join(DATA_DIR, "rulings-meta.json");
const RULINGS_JSONL_PATH = path.join(DATA_DIR, "rulings.jsonl");

type RulingsMeta = {
  updated_at: string;
  jsonl_download_uri: string;
  downloaded_at: string;
  ruling_count: number;
};

const rulingsState = {
  ready: false,
  loading: null as Promise<void> | null,
  meta: null as RulingsMeta | null,
  byOracle: new Map<string, BulkRuling[]>(),
};

async function fetchRulingsMeta(): Promise<{
  updated_at: string;
  jsonl_download_uri: string;
}> {
  const res = await fetch("https://api.scryfall.com/bulk-data/rulings", {
    headers: SCRYFALL_HEADERS,
  });
  if (!res.ok) throw new Error(`rulings bulk-data metadata failed: ${res.status}`);
  const data = (await res.json()) as {
    updated_at: string;
    jsonl_download_uri?: string;
    download_uri?: string;
  };
  const uri = data.jsonl_download_uri || data.download_uri;
  if (!uri) throw new Error("No download URI in rulings bulk-data response");
  return { updated_at: data.updated_at, jsonl_download_uri: uri };
}

async function downloadRulingsJsonl(uri: string): Promise<void> {
  await ensureDataDir();
  const res = await fetch(uri, { headers: SCRYFALL_HEADERS });
  if (!res.ok || !res.body) throw new Error(`rulings download failed: ${res.status}`);
  const tmp = RULINGS_JSONL_PATH + ".tmp";
  const out = fs.createWriteStream(tmp);
  const isGz = uri.endsWith(".gz") || uri.includes(".jsonl.gz");
  const nodeStream = (await import("node:stream")).Readable.fromWeb(
    res.body as import("node:stream/web").ReadableStream
  );
  await new Promise<void>((resolve, reject) => {
    const pipeline = isGz ? nodeStream.pipe(createGunzip()) : nodeStream;
    pipeline.pipe(out);
    out.on("finish", () => resolve());
    out.on("error", reject);
    pipeline.on("error", reject);
  });
  await fsp.rename(tmp, RULINGS_JSONL_PATH);
}

async function indexRulingsJsonl(): Promise<number> {
  rulingsState.byOracle = new Map();
  const stream = fs.createReadStream(RULINGS_JSONL_PATH);
  const rl = createInterface({ input: stream, crlfDelay: Infinity });
  let count = 0;
  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      const row = JSON.parse(line) as BulkRuling;
      const oid = norm(row.oracle_id ?? "");
      if (!oid || !row.comment) continue;
      const list = rulingsState.byOracle.get(oid) ?? [];
      list.push({
        object: "ruling",
        oracle_id: oid,
        source: row.source,
        published_at: row.published_at,
        comment: row.comment,
      });
      rulingsState.byOracle.set(oid, list);
      count++;
    } catch {
      /* skip bad line */
    }
  }
  rulingsState.ready = true;
  return count;
}

async function loadRulingsFromDisk(): Promise<boolean> {
  try {
    await fsp.access(RULINGS_JSONL_PATH);
    const count = await indexRulingsJsonl();
    try {
      const raw = await fsp.readFile(RULINGS_META_PATH, "utf8");
      rulingsState.meta = JSON.parse(raw) as RulingsMeta;
    } catch {
      rulingsState.meta = {
        updated_at: "",
        jsonl_download_uri: "",
        downloaded_at: new Date().toISOString(),
        ruling_count: count,
      };
    }
    console.log(`[bulk] loaded ${count} rulings from disk`);
    return true;
  } catch {
    return false;
  }
}

export async function ensureRulingsData(options?: { force?: boolean }): Promise<void> {
  if (rulingsState.ready && !options?.force) return;
  if (rulingsState.loading) return rulingsState.loading;
  rulingsState.loading = (async () => {
    await ensureDataDir();
    if (!options?.force) {
      const ok = await loadRulingsFromDisk();
      if (ok) {
        void (async () => {
          if (!rulingsState.meta?.updated_at) return;
          const meta = await fetchRulingsMeta();
          if (meta.updated_at === rulingsState.meta.updated_at) return;
          console.log("[bulk] newer rulings available — refreshing");
          await ensureRulingsData({ force: true });
        })().catch((e) => console.warn("[bulk] rulings refresh failed:", e));
        return;
      }
    }
    console.log("[bulk] downloading rulings from Scryfall…");
    const meta = await fetchRulingsMeta();
    await downloadRulingsJsonl(meta.jsonl_download_uri);
    const count = await indexRulingsJsonl();
    rulingsState.meta = {
      updated_at: meta.updated_at,
      jsonl_download_uri: meta.jsonl_download_uri,
      downloaded_at: new Date().toISOString(),
      ruling_count: count,
    };
    await fsp.writeFile(RULINGS_META_PATH, JSON.stringify(rulingsState.meta, null, 2));
    console.log(`[bulk] indexed ${count} rulings (updated ${meta.updated_at})`);
  })().finally(() => {
    rulingsState.loading = null;
  });
  return rulingsState.loading;
}

export function getRulingsByOracleId(oracleId: string): BulkRuling[] {
  if (!rulingsState.ready) return [];
  return rulingsState.byOracle.get(norm(oracleId)) ?? [];
}

export function rulingsStatus(): {
  ready: boolean;
  ruling_count: number;
  updated_at: string | null;
} {
  return {
    ready: rulingsState.ready,
    ruling_count: rulingsState.meta?.ruling_count ?? rulingsState.byOracle.size,
    updated_at: rulingsState.meta?.updated_at ?? null,
  };
}

export function getRandomCard(): BulkCard | null {
  if (!state.ready || state.names.length === 0) return null;
  const key = state.names[Math.floor(Math.random() * state.names.length)];
  return state.byName.get(key) ?? null;
}

/** Prefix autocomplete from local name index (max 20). */
export function autocompleteNames(q: string, limit = 20): string[] {
  if (!state.ready || q.trim().length < 2) return [];
  const prefix = norm(q);
  const out: string[] = [];
  // state.names is sorted — linear scan is fine for ~30k unique names
  for (const n of state.names) {
    if (n.startsWith(prefix)) {
      // Return display name from card
      const card = state.byName.get(n);
      out.push(card?.name ?? n);
      if (out.length >= limit) break;
    }
  }
  return out;
}

/**
 * Very small local search: name substring OR exact type pieces.
 * Falls back to live API for complex Scryfall query syntax.
 */
export function simpleNameSearch(
  q: string,
  limit = 60
): BulkCard[] {
  if (!state.ready) return [];
  const query = norm(q);
  if (!query) return [];

  // If query looks like Scryfall syntax, skip local
  if (/[:=<>()"]/.test(q) || /\b(o|t|c|id|set|cmc|pow|tou):/i.test(q)) {
    return [];
  }

  const out: BulkCard[] = [];
  const seen = new Set<string>();
  for (const [nameKey, card] of state.byName) {
    if (nameKey.includes(query)) {
      const id = norm(String(card.id));
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(card);
      if (out.length >= limit) break;
    }
  }
  return out;
}
