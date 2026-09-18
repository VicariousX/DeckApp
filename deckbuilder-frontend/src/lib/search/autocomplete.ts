export const TYPE_SUGGESTIONS = [
  "creature", "instant", "sorcery", "enchantment", "artifact", "land",
  "planeswalker", "battle", "legendary", "basic", "snow", "tribal",
  "human", "elf", "goblin", "zombie", "wizard", "warrior", "dragon",
  "angel", "demon", "spirit", "equipment", "aura", "saga", "vehicle",
];

export const KEYWORD_SUGGESTIONS = [
  "flying", "trample", "haste", "lifelink", "deathtouch", "vigilance",
  "hexproof", "ward", "menace", "reach", "first strike", "double strike",
  "flash", "defender", "prowess", "scry", "surveil", "exploit", "cascade",
  "storm", "affinity", "modular", "equip", "convoke", "delve",
];

export const FORMAT_SUGGESTIONS = [
  "commander", "modern", "legacy", "vintage", "pioneer", "standard",
  "pauper", "brawl", "historic", "alchemy", "timeless", "oathbreaker",
];

export const RARITY_SUGGESTIONS = [
  "common", "uncommon", "rare", "mythic", "special", "bonus",
];

export function suggestionsFor(category: string, field: string): string[] {
  if (category === "type" || field === "t" || field === "type") return TYPE_SUGGESTIONS;
  if (field === "kw" || field === "keyword") return KEYWORD_SUGGESTIONS;
  if (category === "format" || field === "f" || field === "banned" || field === "restricted") {
    return FORMAT_SUGGESTIONS;
  }
  if (category === "rarity" || field === "r") return RARITY_SUGGESTIONS;
  if (category === "flags" || field === "is") {
    return [
      "spell", "permanent", "historic", "vanilla", "dfc", "mdfc", "split",
      "hybrid", "phyrexian", "promo", "reprint", "funny", "commander",
    ];
  }
  return [];
}

export function fieldAllowsSymbols(category: string, field: string): boolean {
  return (
    category === "text" ||
    category === "mana" ||
    field === "o" ||
    field === "fo" ||
    field === "ft" ||
    field === "m" ||
    field === "devotion"
  );
}
