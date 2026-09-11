/**
 * Primary type category for grouping deck lists.
 * Order matches common decklist conventions.
 */
export const TYPE_GROUP_ORDER = [
  "Commander",
  "Creature",
  "Planeswalker",
  "Instant",
  "Sorcery",
  "Enchantment",
  "Artifact",
  "Battle",
  "Land",
  "Other",
] as const;

export type TypeGroup = (typeof TYPE_GROUP_ORDER)[number];

/**
 * Extract a single primary type group from a Scryfall type_line.
 * Handles dual types like "Artifact Creature — Golem" → Creature.
 */
export function primaryTypeGroup(typeLine: string | null | undefined): TypeGroup {
  const t = (typeLine ?? "").toLowerCase();
  if (!t) return "Other";
  // Prefer creature over artifact when both present
  if (t.includes("creature")) return "Creature";
  if (t.includes("planeswalker")) return "Planeswalker";
  if (t.includes("instant")) return "Instant";
  if (t.includes("sorcery")) return "Sorcery";
  if (t.includes("enchantment")) return "Enchantment";
  if (t.includes("artifact")) return "Artifact";
  if (t.includes("battle")) return "Battle";
  if (t.includes("land")) return "Land";
  return "Other";
}

export function sortTypeGroups(groups: string[]): string[] {
  return [...groups].sort((a, b) => {
    const ia = TYPE_GROUP_ORDER.indexOf(a as TypeGroup);
    const ib = TYPE_GROUP_ORDER.indexOf(b as TypeGroup);
    const sa = ia === -1 ? 999 : ia;
    const sb = ib === -1 ? 999 : ib;
    if (sa !== sb) return sa - sb;
    return a.localeCompare(b);
  });
}
