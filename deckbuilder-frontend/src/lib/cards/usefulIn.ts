import {
  normalizeColorIdentity,
  type ColorLetter,
} from "./cardSort";

/** Controlled vocabulary for user_cards.useful_in */
export type UsefulInTag =
  | "colorless"
  | "mono"
  | "multi"
  | "wubrg"
  | ColorLetter;

const COLOR_SET = new Set(["W", "U", "B", "R", "G"]);

export function normalizeUsefulIn(tags: string[] | null | undefined): UsefulInTag[] {
  if (!tags?.length) return [];
  const out: UsefulInTag[] = [];
  for (const raw of tags) {
    const t = raw.toLowerCase();
    if (t === "colorless" || t === "mono" || t === "multi" || t === "wubrg") {
      out.push(t);
      continue;
    }
    const up = raw.toUpperCase();
    if (COLOR_SET.has(up)) out.push(up as ColorLetter);
  }
  return [...new Set(out)];
}

/**
 * Whether a card's "Useful in" tags match a deck's color identity.
 * Empty tags → no restriction (always useful).
 *
 * - colorless: deck has no colors
 * - mono + color: deck is exactly that one color
 * - mono alone: deck is any monocolor
 * - multi: deck has 2+ colors
 * - wubrg: deck has all five colors
 * - color letters (without mono): deck includes each listed color
 */
export function isUsefulInDeck(
  tags: string[] | null | undefined,
  deckIdentity: string[] | null | undefined
): boolean {
  const useful = normalizeUsefulIn(tags);
  if (useful.length === 0) return true;

  const deck = normalizeColorIdentity(deckIdentity);
  const modes = new Set(useful.filter((t) => !COLOR_SET.has(t)));
  const colors = useful.filter((t): t is ColorLetter => COLOR_SET.has(t));

  if (modes.has("colorless")) {
    return deck.length === 0;
  }
  if (modes.has("wubrg")) {
    return deck.length === 5;
  }
  if (modes.has("multi")) {
    return deck.length >= 2;
  }
  if (modes.has("mono")) {
    if (colors.length === 1) {
      return deck.length === 1 && deck[0] === colors[0];
    }
    // Mono without a color: any monocolor deck
    return deck.length === 1;
  }
  // Color containment: deck must include all selected colors
  // (Yavimaya → G means useful where deck has green)
  if (colors.length > 0) {
    return colors.every((c) => deck.includes(c));
  }
  return true;
}

export function usefulInSummary(tags: string[] | null | undefined): string {
  const useful = normalizeUsefulIn(tags);
  if (useful.length === 0) return "Any deck";
  if (useful.includes("colorless")) return "Colorless decks only";
  if (useful.includes("wubrg")) return "5-color (WUBRG) decks only";
  if (useful.includes("multi")) return "Multicolor decks only";
  if (useful.includes("mono")) {
    const c = useful.find((t) => COLOR_SET.has(t));
    return c ? `Mono ${c} decks only` : "Monocolor decks only";
  }
  const cols = useful.filter((t) => COLOR_SET.has(t));
  if (cols.length) return `Decks including ${cols.join("")}`;
  return "Any deck";
}
