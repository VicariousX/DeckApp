/**
 * Modular card sorting for drawers, decks, search, etc.
 * Works with any object that exposes the optional fields below.
 */

export type ColorLetter = "W" | "U" | "B" | "R" | "G";

export type SortableCard = {
  name?: string | null;
  type_line?: string | null;
  mana_cost?: string | null;
  cmc?: number | null;
  color_identity?: string[] | null;
  colors?: string[] | null;
  oracle_text?: string | null;
  /** Optional stable tie-breaker */
  id?: string | null;
  oracle_id?: string | null;
};

export type CardSortKey =
  | "name"
  | "cmc"
  | "type"
  | "color"
  /** Groups similar rules text (helps cluster cycles / variants). */
  | "oracle"
  | "manual";

export const CARD_SORT_OPTIONS: { id: CardSortKey; label: string }[] = [
  { id: "name", label: "Name" },
  { id: "color", label: "Color identity" },
  { id: "cmc", label: "Mana value" },
  { id: "type", label: "Type" },
  { id: "oracle", label: "Oracle text" },
];

const WUBRG: ColorLetter[] = ["W", "U", "B", "R", "G"];
const COLOR_RANK: Record<string, number> = {
  W: 0,
  U: 1,
  B: 2,
  R: 3,
  G: 4,
};

/** Normalize identity to WUBRG order, unique. */
export function normalizeColorIdentity(
  identity: string[] | null | undefined
): ColorLetter[] {
  if (!identity?.length) return [];
  const set = new Set(
    identity
      .map((c) => c.toUpperCase())
      .filter((c): c is ColorLetter => c in COLOR_RANK)
  );
  return WUBRG.filter((c) => set.has(c));
}

/**
 * Sort key for color identity:
 * 0 = colorless, 1–5 = monocolor WUBRG, 6+ = multicolor (by WUBRG bitmask).
 */
export function colorIdentitySortKey(
  identity: string[] | null | undefined
): [number, string] {
  const colors = normalizeColorIdentity(identity);
  if (colors.length === 0) return [0, ""];
  if (colors.length === 1) return [1 + COLOR_RANK[colors[0]], colors[0]];
  // Multicolor: order by WUBRG bitmask so GU groups, etc.
  let mask = 0;
  for (const c of colors) mask |= 1 << COLOR_RANK[c];
  return [6 + mask, colors.join("")];
}

/** Best-effort identity from mana cost when color_identity is missing. */
export function colorIdentityFromManaCost(
  manaCost: string | null | undefined
): ColorLetter[] {
  if (!manaCost) return [];
  const found = new Set<ColorLetter>();
  for (const c of WUBRG) {
    if (manaCost.includes(`{${c}}`) || manaCost.includes(`/${c}`)) {
      found.add(c);
    }
  }
  // Hybrid like {G/U}
  const hybrid = manaCost.matchAll(/\{([WUBRG])\/([WUBRG])\}/gi);
  for (const m of hybrid) {
    found.add(m[1].toUpperCase() as ColorLetter);
    found.add(m[2].toUpperCase() as ColorLetter);
  }
  return WUBRG.filter((c) => found.has(c));
}

export function effectiveColorIdentity(card: SortableCard): ColorLetter[] {
  const fromField = normalizeColorIdentity(
    card.color_identity ?? card.colors ?? undefined
  );
  if (fromField.length) return fromField;
  return colorIdentityFromManaCost(card.mana_cost);
}

/**
 * Normalize oracle text so cycle members with the same template group together.
 * - Lowercase, collapse whitespace
 * - Strip the card's own name (cycles often only differ by name in text)
 * - Strip reminder text in parentheses
 */
export function normalizeOracleText(
  text: string | null | undefined,
  cardName?: string | null
): string {
  if (!text) return "";
  let t = text.toLowerCase();
  t = t.replace(/\([^)]*\)/g, " ");
  if (cardName) {
    const base = cardName.split("//")[0].trim().toLowerCase();
    if (base.length > 2) {
      t = t.split(base).join(" ");
    }
  }
  t = t.replace(/\s+/g, " ").trim();
  return t;
}

function primaryType(typeLine: string | null | undefined): string {
  if (!typeLine) return "";
  // After em-dash or hyphen: subtypes; before: super/types
  const main = typeLine.split("—")[0].split("-")[0].trim().toLowerCase();
  return main;
}

function cmpStr(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: "base" });
}

function tieBreak(a: SortableCard, b: SortableCard): number {
  const byName = cmpStr(a.name ?? "", b.name ?? "");
  if (byName !== 0) return byName;
  return cmpStr(
    a.oracle_id ?? a.id ?? "",
    b.oracle_id ?? b.id ?? ""
  );
}

export function compareCards(
  a: SortableCard,
  b: SortableCard,
  key: CardSortKey
): number {
  if (key === "manual") return 0;

  if (key === "name") {
    return tieBreak(a, b);
  }

  if (key === "cmc") {
    const ca = a.cmc ?? 0;
    const cb = b.cmc ?? 0;
    if (ca !== cb) return ca - cb;
    return tieBreak(a, b);
  }

  if (key === "type") {
    const ta = primaryType(a.type_line);
    const tb = primaryType(b.type_line);
    const c = cmpStr(ta, tb);
    if (c !== 0) return c;
    return tieBreak(a, b);
  }

  if (key === "color") {
    const [ra, sa] = colorIdentitySortKey(effectiveColorIdentity(a));
    const [rb, sb] = colorIdentitySortKey(effectiveColorIdentity(b));
    if (ra !== rb) return ra - rb;
    const sc = cmpStr(sa, sb);
    if (sc !== 0) return sc;
    return tieBreak(a, b);
  }

  if (key === "oracle") {
    const oa = normalizeOracleText(a.oracle_text, a.name);
    const ob = normalizeOracleText(b.oracle_text, b.name);
    // Empty oracle text last
    if (oa && !ob) return -1;
    if (!oa && ob) return 1;
    const c = cmpStr(oa, ob);
    if (c !== 0) return c;
    return tieBreak(a, b);
  }

  return tieBreak(a, b);
}

/** Returns a new sorted array. `manual` preserves input order. */
export function sortCardsBy<T extends SortableCard>(
  cards: T[],
  key: CardSortKey
): T[] {
  if (key === "manual" || cards.length < 2) return [...cards];
  return [...cards].sort((a, b) => compareCards(a, b, key));
}
