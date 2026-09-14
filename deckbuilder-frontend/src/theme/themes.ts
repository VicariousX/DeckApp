/** App theme catalog — aesthetic names + MTG two-color guild names. */

export type ThemeGroup = "signature" | "realm" | "guild";

export type AppThemeId =
  | "premium"
  | "arcane"
  | "ember"
  | "frost"
  | "verdant"
  | "nocturne"
  | "azorius"
  | "dimir"
  | "rakdos"
  | "gruul"
  | "selesnya"
  | "orzhov"
  | "izzet"
  | "golgari"
  | "boros"
  | "simic";

export type ThemeMeta = {
  id: AppThemeId;
  label: string;
  group: ThemeGroup;
  blurb: string;
  swatch: string;
};

export const THEMES: ThemeMeta[] = [
  { id: "premium", label: "Premium", group: "signature", blurb: "Gold & ink", swatch: "#d4af37" },
  { id: "arcane", label: "Arcane", group: "signature", blurb: "Violet mystery", swatch: "#a78bfa" },
  { id: "ember", label: "Ember", group: "realm", blurb: "Warm ruby", swatch: "#e85d4c" },
  { id: "frost", label: "Frost", group: "realm", blurb: "Cold sapphire", swatch: "#5b9fd4" },
  { id: "verdant", label: "Verdant", group: "realm", blurb: "Living green", swatch: "#6dbf6a" },
  { id: "nocturne", label: "Nocturne", group: "realm", blurb: "Moonlit silver", swatch: "#9aa3b2" },
  { id: "azorius", label: "Azorius", group: "guild", blurb: "W/U — law", swatch: "#c9d6e8" },
  { id: "dimir", label: "Dimir", group: "guild", blurb: "U/B — secrecy", swatch: "#6b7db3" },
  { id: "rakdos", label: "Rakdos", group: "guild", blurb: "B/R — chaos", swatch: "#c44b5a" },
  { id: "gruul", label: "Gruul", group: "guild", blurb: "R/G — wild", swatch: "#c47a3a" },
  { id: "selesnya", label: "Selesnya", group: "guild", blurb: "G/W — growth", swatch: "#8fbf7a" },
  { id: "orzhov", label: "Orzhov", group: "guild", blurb: "W/B — debt", swatch: "#b8a9c9" },
  { id: "izzet", label: "Izzet", group: "guild", blurb: "U/R — genius", swatch: "#5c9ec9" },
  { id: "golgari", label: "Golgari", group: "guild", blurb: "B/G — rot", swatch: "#6a8f5c" },
  { id: "boros", label: "Boros", group: "guild", blurb: "R/W — justice", swatch: "#d4845a" },
  { id: "simic", label: "Simic", group: "guild", blurb: "G/U — evolve", swatch: "#4db6a0" },
];

export const THEME_IDS = THEMES.map((t) => t.id);

export function isAppTheme(v: string | null | undefined): v is AppThemeId {
  return !!v && (THEME_IDS as string[]).includes(v);
}

export function themeLabel(id: AppThemeId): string {
  return THEMES.find((t) => t.id === id)?.label ?? id;
}

export const THEME_GROUPS: { id: ThemeGroup; label: string }[] = [
  { id: "signature", label: "Signature" },
  { id: "realm", label: "Realms" },
  { id: "guild", label: "Guilds" },
];

export function themesInGroup(group: ThemeGroup): ThemeMeta[] {
  return THEMES.filter((t) => t.group === group);
}
