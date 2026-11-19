/** Each page owns one cell. Similar pages sit in a cluster so a pan stays short. */

export type Cluster = "search" | "home" | "library" | "table";

export type Zone = {
  id: string;
  label: string;
  col: number;
  row: number;
  cluster: Cluster;
  /** Asset-heavy views use the map flight as their loading screen. */
  heavy: boolean;
};

export const GRID = { cols: 6, rows: 4 };

export const ZONES = {
  simple: { id: "simple", label: "Simple", col: 0, row: 0, cluster: "search", heavy: false },
  standard: { id: "standard", label: "Standard", col: 1, row: 0, cluster: "search", heavy: false },
  advanced: { id: "advanced", label: "Advanced", col: 2, row: 0, cluster: "search", heavy: false },
  results: { id: "results", label: "Results", col: 3, row: 0, cluster: "search", heavy: true },
  card: { id: "card", label: "Card", col: 4, row: 0, cluster: "search", heavy: true },
  login: { id: "login", label: "You", col: 1, row: 1, cluster: "home", heavy: false },
  home: { id: "home", label: "Home", col: 2, row: 1, cluster: "home", heavy: false },
  social: { id: "social", label: "Social", col: 3, row: 1, cluster: "home", heavy: false },
  formats: { id: "formats", label: "Formats", col: 4, row: 1, cluster: "home", heavy: false },
  public: { id: "public", label: "Public decks", col: 5, row: 1, cluster: "home", heavy: false },
  mine: { id: "mine", label: "My decks", col: 0, row: 2, cluster: "library", heavy: false },
  drawers: { id: "drawers", label: "Drawers", col: 1, row: 2, cluster: "library", heavy: true },
  collections: { id: "collections", label: "Collections", col: 2, row: 2, cluster: "library", heavy: true },
  combos: { id: "combos", label: "Combos", col: 3, row: 2, cluster: "library", heavy: true },
  deck: { id: "deck", label: "Deck", col: 4, row: 2, cluster: "table", heavy: true },
  branches: { id: "branches", label: "Branches", col: 5, row: 2, cluster: "table", heavy: false },
  play: { id: "play", label: "Play", col: 4, row: 3, cluster: "table", heavy: true },
  proxy: { id: "proxy", label: "Proxies", col: 5, row: 3, cluster: "table", heavy: false },
} as const satisfies Record<string, Zone>;

export function zoneAt(col: number, row: number): Zone | undefined {
  return Object.values(ZONES).find((zone) => zone.col === col && zone.row === row);
}

export function placeKey(pathname: string, search: string) {
  if (pathname === "/search") {
    const mode = new URLSearchParams(search).get("mode");
    return mode === "advanced" ? "/search?mode=advanced" : "/search?mode=standard";
  }
  return pathname;
}

export function zoneFor(key: string): Zone {
  const path = key.split("?")[0];
  if (key.includes("mode=advanced")) return ZONES.advanced;
  if (path === "/search") return ZONES.standard;
  if (path.startsWith("/search/simple")) return ZONES.simple;
  if (path.startsWith("/search/results")) return ZONES.results;
  if (path.startsWith("/card/")) return ZONES.card;
  if (path.startsWith("/play/")) return ZONES.play;
  if (/^\/deck\/[^/]+\/branches/.test(path)) return ZONES.branches;
  if (path.startsWith("/deck/")) return ZONES.deck;
  if (path.startsWith("/my-decks")) return ZONES.mine;
  if (path.startsWith("/drawers")) return ZONES.drawers;
  if (path.startsWith("/collections")) return ZONES.collections;
  if (path.startsWith("/combos")) return ZONES.combos;
  if (path.startsWith("/social")) return ZONES.social;
  if (path.startsWith("/formats")) return ZONES.formats;
  if (path.startsWith("/decks")) return ZONES.public;
  if (path.startsWith("/proxy-set")) return ZONES.proxy;
  if (path.startsWith("/login")) return ZONES.login;
  return ZONES.home;
}
