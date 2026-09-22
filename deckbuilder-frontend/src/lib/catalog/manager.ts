import { apiUrl } from "../apiBase";
import {
  catalogReady,
  clearCatalog,
  readMeta,
  setCatalogReadyCache,
  writeMeta,
} from "./db";
import { readCatalogTier, writeCatalogTier } from "./preference";
import {
  TIER_COPY,
  TIER_FILES,
  type CatalogFileKind,
  type CatalogProgress,
  type CatalogTier,
} from "./types";

type Listener = (p: CatalogProgress) => void;

const listeners = new Set<Listener>();

let progress: CatalogProgress = {
  phase: "idle",
  loaded: 0,
  total: 0,
  message: "",
};

let running: Promise<void> | null = null;

export function getCatalogProgress(): CatalogProgress {
  return progress;
}

export function subscribeCatalog(fn: Listener): () => void {
  listeners.add(fn);
  fn(progress);
  return () => listeners.delete(fn);
}

function emit(next: Partial<CatalogProgress> & { phase: CatalogProgress["phase"] }) {
  progress = { ...progress, ...next };
  for (const fn of listeners) fn(progress);
}

type BulkMeta = {
  updated_at?: string;
  download_uri?: string;
  jsonl_download_uri?: string;
  size?: number;
  compressed_size?: number;
};

function bulkFileUrl(data: BulkMeta): string | undefined {
  return data.jsonl_download_uri || data.download_uri;
}

async function fetchBulkMeta(type: CatalogFileKind): Promise<BulkMeta> {
  const paths = [
    apiUrl(`/api/scryfall/bulk-data/${type}`),
    `https://api.scryfall.com/bulk-data/${type}`,
  ];
  let lastErr = `No download URI for ${type}`;
  for (const url of paths) {
    try {
      const res = await fetch(url);
      const data = (await res.json()) as BulkMeta & { error?: string };
      const file = bulkFileUrl(data);
      if (res.ok && file) {
        return { ...data, download_uri: file };
      }
      lastErr = data.error || lastErr;
    } catch (e) {
      lastErr = e instanceof Error ? e.message : lastErr;
    }
  }
  throw new Error(lastErr);
}

export async function applyCatalogTier(
  tier: CatalogTier,
  opts?: { force?: boolean }
): Promise<void> {
  writeCatalogTier(tier);
  if (tier === "live") {
    await clearCatalog();
    setCatalogReadyCache(false);
    emit({ phase: "idle", loaded: 0, total: 0, message: "Using live throttled API." });
    return;
  }
  if (running) return running;
  running = (async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.storage?.persist) {
        void navigator.storage.persist();
      }
      const existing = await readMeta();
      emit({ phase: "meta", loaded: 0, total: 1, message: "Checking Scryfall bulk catalog…" });

      const files = TIER_FILES[tier];
      const metas: Record<string, BulkMeta> = {};
      for (const file of files) {
        metas[file] = await fetchBulkMeta(file);
      }
      const stamp = files.map((f) => metas[f].updated_at ?? "").join("|");
      if (
        !opts?.force &&
        existing &&
        existing.tier === tier &&
        existing.updated_at === stamp &&
        existing.card_count > 0
      ) {
        emit({
          phase: "ready",
          loaded: existing.card_count,
          total: existing.card_count,
          message: `Local catalog current (${existing.card_count.toLocaleString()} cards).`,
        });
        return;
      }

      const worker = new Worker(new URL("./ingest.worker.ts", import.meta.url), {
        type: "module",
      });

      let cards = 0;
      let rulings = 0;
      let firstCards = true;
      for (const file of files) {
        const meta = metas[file];
        emit({
          phase: "download",
          file,
          loaded: 0,
          total: 1,
          message: `Downloading ${file}…`,
        });
        const count = await runWorker(worker, {
          type: "start",
          kind: file,
          url: meta.download_uri!,
          replaceCards: firstCards && file !== "rulings",
        });
        if (file === "rulings") rulings = count;
        else {
          cards = count;
          firstCards = false;
        }
      }
      worker.terminate();

      await writeMeta({
        key: "catalog",
        tier,
        updated_at: stamp,
        downloaded_at: new Date().toISOString(),
        card_count: cards,
        ruling_count: rulings,
        size_hint: TIER_COPY[tier].size,
      });
      setCatalogReadyCache(true);
      emit({
        phase: "ready",
        loaded: cards,
        total: cards,
        message: `Ready — ${cards.toLocaleString()} cards, ${rulings.toLocaleString()} rulings.`,
      });
    } catch (err) {
      emit({
        phase: "error",
        loaded: 0,
        total: 0,
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      running = null;
    }
  })();
  return running;
}

function runWorker(
  worker: Worker,
  payload: {
    type: "start";
    kind: CatalogFileKind;
    url: string;
    replaceCards: boolean;
  }
): Promise<number> {
  return new Promise((resolve, reject) => {
    const onMsg = (ev: MessageEvent) => {
      const data = ev.data as {
        type: string;
        phase?: CatalogProgress["phase"];
        loaded?: number;
        total?: number;
        file?: CatalogFileKind;
        kind?: CatalogFileKind;
        count?: number;
        message?: string;
      };
      if (data.type === "progress") {
        emit({
          phase: data.phase ?? "index",
          file: data.file,
          loaded: data.loaded ?? 0,
          total: data.total ?? 1,
          message:
            data.phase === "download"
              ? `Downloading ${data.file ?? ""}…`
              : `Indexing ${data.file ?? ""} (${(data.loaded ?? 0).toLocaleString()} / ${(data.total ?? 0).toLocaleString()})`,
        });
      } else if (data.type === "done") {
        worker.removeEventListener("message", onMsg);
        resolve(data.count ?? 0);
      } else if (data.type === "error") {
        worker.removeEventListener("message", onMsg);
        reject(new Error(data.message || "Ingest failed"));
      }
    };
    worker.addEventListener("message", onMsg);
    worker.postMessage(payload);
  });
}

export async function bootCatalog(): Promise<void> {
  const tier = readCatalogTier();
  if (tier === "live") {
    const ready = await catalogReady();
    if (ready) {
      /* leftover from a previous choice — leave data, stay live */
    }
    emit({ phase: "idle", loaded: 0, total: 0, message: "Live throttled mode." });
    return;
  }
  void applyCatalogTier(tier);
}

export { readCatalogTier, writeCatalogTier };
