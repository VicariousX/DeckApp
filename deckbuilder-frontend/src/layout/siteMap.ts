/** A page's place on the site atlas. Offsets are percent from the center of the view. */

export type Zone = {
  id: string;
  label: string;
  x: number;
  y: number;
};

export const ZONES = {
  home: { id: "home", label: "Home", x: 0, y: -2 },
  login: { id: "login", label: "You", x: -12, y: 8 },
  simple: { id: "simple", label: "Simple", x: -28, y: -26 },
  standard: { id: "standard", label: "Standard", x: -14, y: -32 },
  advanced: { id: "advanced", label: "Advanced", x: 0, y: -28 },
  results: { id: "results", label: "Results", x: -16, y: -14 },
  card: { id: "card", label: "Card", x: -2, y: -14 },
  mine: { id: "mine", label: "My decks", x: -30, y: 8 },
  drawers: { id: "drawers", label: "Drawers", x: -36, y: 20 },
  collections: { id: "collections", label: "Collections", x: -22, y: 20 },
  combos: { id: "combos", label: "Combos", x: -12, y: 30 },
  deck: { id: "deck", label: "Deck", x: -4, y: 16 },
  branches: { id: "branches", label: "Branches", x: 8, y: 26 },
  play: { id: "play", label: "Play", x: 4, y: 34 },
  social: { id: "social", label: "Social", x: 24, y: -12 },
  formats: { id: "formats", label: "Formats", x: 34, y: 0 },
  public: { id: "public", label: "Public decks", x: 22, y: 12 },
  proxy: { id: "proxy", label: "Proxies", x: 34, y: 22 },
} as const satisfies Record<string, Zone>;

/** Neighborhoods, drawn as constellations rather than a grid. */
export const CONSTELLATIONS: Zone[][] = [
  [ZONES.simple, ZONES.standard, ZONES.advanced, ZONES.card, ZONES.results],
  [ZONES.mine, ZONES.drawers, ZONES.collections, ZONES.combos, ZONES.deck, ZONES.branches, ZONES.play],
  [ZONES.social, ZONES.formats, ZONES.public, ZONES.proxy],
  [ZONES.home, ZONES.login],
];

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

export function mapSpread() {
  if (typeof window === "undefined") return 1;
  return window.matchMedia("(max-width: 720px)").matches ? 0.62 : 1;
}

/** Percent offsets, bowed so the trip arcs instead of cutting through the middle. */
export function arc(from: Zone, to: Zone, spread: number) {
  const fx = from.x * spread;
  const fy = from.y * spread;
  const tx = to.x * spread;
  const ty = to.y * spread;
  const mx = (fx + tx) / 2 + (ty - fy) * 0.28;
  const my = (fy + ty) / 2 - (tx - fx) * 0.28;
  return { fx, fy, mx, my, tx, ty };
}
