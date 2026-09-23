import type { CatalogTier } from "./types";

const KEY = "deckapp.catalogTier";

export function readCatalogTier(): CatalogTier {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === "core" || raw === "live") return raw;
    if (raw === "prints") return "core";
  } catch {
    /* ignore */
  }
  return "live";
}

export function writeCatalogTier(tier: CatalogTier): void {
  try {
    localStorage.setItem(KEY, tier);
  } catch {
    /* ignore */
  }
}
