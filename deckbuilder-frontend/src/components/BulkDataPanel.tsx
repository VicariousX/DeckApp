import { useEffect, useState } from "react";
import {
  applyCatalogTier,
  getCatalogProgress,
  readCatalogTier,
  subscribeCatalog,
} from "../lib/catalog/manager";
import { readMeta } from "../lib/catalog/db";
import {
  TIER_COPY,
  type CatalogProgress,
  type CatalogTier,
} from "../lib/catalog/types";
import type { CatalogMeta } from "../lib/catalog/types";
import styles from "./BulkDataPanel.module.css";

const TIERS: CatalogTier[] = ["live", "core", "prints"];

export function BulkDataPanel() {
  const [tier, setTier] = useState<CatalogTier>(() => readCatalogTier());
  const [progress, setProgress] = useState<CatalogProgress>(() =>
    getCatalogProgress()
  );
  const [meta, setMeta] = useState<CatalogMeta | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => subscribeCatalog(setProgress), []);
  useEffect(() => {
    void readMeta().then(setMeta);
  }, [progress.phase]);

  async function choose(next: CatalogTier) {
    if (busy) return;
    setTier(next);
    setBusy(true);
    await applyCatalogTier(next);
    setBusy(false);
    setMeta(await readMeta());
  }

  const pct =
    progress.total > 0
      ? Math.min(100, Math.round((progress.loaded / progress.total) * 100))
      : progress.phase === "download"
        ? 15
        : 0;

  return (
    <div className={styles.wrap}>
      {TIERS.map((id) => {
        const copy = TIER_COPY[id];
        return (
          <button
            key={id}
            type="button"
            className={`${styles.card} ${tier === id ? styles.cardActive : ""}`}
            onClick={() => void choose(id)}
            disabled={busy && progress.phase !== "idle" && progress.phase !== "ready" && progress.phase !== "error"}
          >
            <input
              className={styles.radio}
              type="radio"
              name="catalog-tier"
              checked={tier === id}
              readOnly
              tabIndex={-1}
            />
            <div>
              <div className={styles.title}>{copy.label}</div>
              <span className={styles.size}>{copy.size}</span>
              <p className={styles.blurb}>{copy.blurb}</p>
            </div>
          </button>
        );
      })}

      <p className={`${styles.status} ${progress.phase === "error" ? styles.err : ""}`}>
        {progress.message ||
          (tier === "live"
            ? "No local catalog. Requests share a polite Scryfall queue."
            : "Choose a pack to download onto this device.")}
      </p>
      {(progress.phase === "download" || progress.phase === "index" || progress.phase === "meta") && (
        <div className={styles.bar} aria-hidden>
          <div className={styles.fill} style={{ width: `${pct}%` }} />
        </div>
      )}
      {meta && tier !== "live" && progress.phase === "ready" && (
        <p className={styles.status}>
          Stored {meta.card_count.toLocaleString()} cards
          {meta.ruling_count ? ` · ${meta.ruling_count.toLocaleString()} rulings` : ""}
          {meta.downloaded_at ? ` · updated ${new Date(meta.downloaded_at).toLocaleString()}` : ""}
        </p>
      )}
      {tier !== "live" && (progress.phase === "ready" || progress.phase === "error") && (
        <div className={styles.row}>
          <button
            type="button"
            className={styles.card}
            style={{ display: "block" }}
            onClick={() => void applyCatalogTier(tier, { force: true })}
          >
            Re-download this pack
          </button>
        </div>
      )}
    </div>
  );
}
