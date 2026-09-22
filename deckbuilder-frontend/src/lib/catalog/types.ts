export type CatalogTier = "live" | "core" | "prints";

export type CatalogFileKind = "oracle-cards" | "default-cards" | "rulings";

export type CatalogMeta = {
  key: string;
  tier: CatalogTier;
  updated_at: string;
  downloaded_at: string;
  card_count: number;
  ruling_count: number;
  size_hint: string;
};

export type CatalogProgress = {
  phase: "idle" | "meta" | "download" | "index" | "ready" | "error";
  file?: CatalogFileKind;
  loaded: number;
  total: number;
  message: string;
};

export const TIER_FILES: Record<CatalogTier, CatalogFileKind[]> = {
  live: [],
  core: ["oracle-cards", "rulings"],
  prints: ["default-cards", "rulings"],
};

export const TIER_COPY: Record<
  CatalogTier,
  { label: string; size: string; blurb: string }
> = {
  live: {
    label: "Live (throttled)",
    size: "No download",
    blurb:
      "Cards load through our rate-limited Scryfall proxy as you open them. Best on shared or small devices. Advanced search always uses this path.",
  },
  core: {
    label: "Unique cards + rulings",
    size: "~40–80 MB on disk",
    blurb:
      "One printing per unique card (oracle-cards) plus official rulings. Name lookup, autocomplete, card pages, and rulings stay local. The print picker still uses the live API.",
  },
  prints: {
    label: "All English printings + rulings",
    size: "~150–250 MB on disk",
    blurb:
      "Every English printing (default-cards) plus rulings. Print picker, preferred-art matching, and card-by-id are local. Largest option we recommend; we do not offer the multi-language dump.",
  },
};
