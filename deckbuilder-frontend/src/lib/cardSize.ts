export type CardSizeKey = "search" | "deck" | "drawers" | "collections" | "combos";

type Spec = { min: number; max: number; fallback: number };

export const CARD_SIZE: Record<CardSizeKey, Spec> = {
  search: { min: 140, max: 320, fallback: 220 },
  deck: { min: 110, max: 260, fallback: 160 },
  drawers: { min: 110, max: 260, fallback: 148 },
  collections: { min: 110, max: 260, fallback: 148 },
  combos: { min: 120, max: 280, fallback: 180 },
};

const listeners = new Set<() => void>();

export function readCardSize(key: CardSizeKey): number {
  const spec = CARD_SIZE[key];
  try {
    const n = Number(localStorage.getItem(`deckapp.cardSize.${key}`));
    if (Number.isFinite(n)) return Math.min(spec.max, Math.max(spec.min, Math.round(n)));
  } catch {
    /* ignore */
  }
  return spec.fallback;
}

export function writeCardSize(key: CardSizeKey, value: number) {
  const spec = CARD_SIZE[key];
  const next = Math.min(spec.max, Math.max(spec.min, Math.round(value)));
  try {
    localStorage.setItem(`deckapp.cardSize.${key}`, String(next));
  } catch {
    /* ignore */
  }
  listeners.forEach((listener) => listener());
}

export function subscribeCardSize(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
