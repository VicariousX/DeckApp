/** Each page owns one cell on the site grid. */

export type Zone = {
  id: string;
  label: string;
  col: number;
  row: number;
};

export const GRID = { cols: 6, rows: 4 };

export const ZONES = {
  simple: { id: "simple", label: "Simple", col: 0, row: 0 },
  standard: { id: "standard", label: "Standard", col: 1, row: 0 },
  advanced: { id: "advanced", label: "Advanced", col: 2, row: 0 },
  results: { id: "results", label: "Results", col: 3, row: 0 },
  card: { id: "card", label: "Card", col: 4, row: 0 },
  login: { id: "login", label: "You", col: 1, row: 1 },
  home: { id: "home", label: "Home", col: 2, row: 1 },
  social: { id: "social", label: "Social", col: 3, row: 1 },
  formats: { id: "formats", label: "Formats", col: 4, row: 1 },
  public: { id: "public", label: "Public decks", col: 5, row: 1 },
  mine: { id: "mine", label: "My decks", col: 0, row: 2 },
  drawers: { id: "drawers", label: "Drawers", col: 1, row: 2 },
  collections: { id: "collections", label: "Collections", col: 2, row: 2 },
  combos: { id: "combos", label: "Combos", col: 3, row: 2 },
  deck: { id: "deck", label: "Deck", col: 4, row: 2 },
  branches: { id: "branches", label: "Branches", col: 5, row: 2 },
  play: { id: "play", label: "Play", col: 4, row: 3 },
  proxy: { id: "proxy", label: "Proxies", col: 5, row: 3 },
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
