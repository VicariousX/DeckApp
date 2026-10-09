export type FormatId =
  | "commander"
  | "standard"
  | "modern"
  | "pioneer"
  | "legacy"
  | "pauper"
  | "vintage"
  | "casual"
  | "custom";

export type HouseFormat = {
  id: string;
  name: string;
  deckSize: number | null;
  sideboardSize: number | null;
  copyLimit: number;
  singleton: boolean;
  commanderRequired: boolean;
  colorIdentity: boolean;
  /** Scryfall legality key to also enforce, or empty. */
  legalityKey: string;
  banned: string[];
  restricted: string[];
  notes: string;
  /** Reserved for play-group sharing. Not public until that exists. */
  isPublic: boolean;
};

export type FormatRule = {
  id: string;
  name: string;
  deckSize: number | null;
  minDeckSize: number | null;
  sideboardSize: number | null;
  copyLimit: number;
  singleton: boolean;
  commanderRequired: boolean;
  colorIdentity: boolean;
  legalityKey: string;
  banned: string[];
  restricted: string[];
  house?: boolean;
};

export const BUILTIN_FORMATS: FormatRule[] = [
  {
    id: "commander",
    name: "Commander",
    deckSize: 100,
    minDeckSize: 100,
    sideboardSize: 0,
    copyLimit: 1,
    singleton: true,
    commanderRequired: true,
    colorIdentity: true,
    legalityKey: "commander",
    banned: [],
    restricted: [],
  },
  {
    id: "standard",
    name: "Standard",
    deckSize: null,
    minDeckSize: 60,
    sideboardSize: 15,
    copyLimit: 4,
    singleton: false,
    commanderRequired: false,
    colorIdentity: false,
    legalityKey: "standard",
    banned: [],
    restricted: [],
  },
  {
    id: "modern",
    name: "Modern",
    deckSize: null,
    minDeckSize: 60,
    sideboardSize: 15,
    copyLimit: 4,
    singleton: false,
    commanderRequired: false,
    colorIdentity: false,
    legalityKey: "modern",
    banned: [],
    restricted: [],
  },
  {
    id: "pioneer",
    name: "Pioneer",
    deckSize: null,
    minDeckSize: 60,
    sideboardSize: 15,
    copyLimit: 4,
    singleton: false,
    commanderRequired: false,
    colorIdentity: false,
    legalityKey: "pioneer",
    banned: [],
    restricted: [],
  },
  {
    id: "legacy",
    name: "Legacy",
    deckSize: null,
    minDeckSize: 60,
    sideboardSize: 15,
    copyLimit: 4,
    singleton: false,
    commanderRequired: false,
    colorIdentity: false,
    legalityKey: "legacy",
    banned: [],
    restricted: [],
  },
  {
    id: "pauper",
    name: "Pauper",
    deckSize: null,
    minDeckSize: 60,
    sideboardSize: 15,
    copyLimit: 4,
    singleton: false,
    commanderRequired: false,
    colorIdentity: false,
    legalityKey: "pauper",
    banned: [],
    restricted: [],
  },
  {
    id: "vintage",
    name: "Vintage",
    deckSize: null,
    minDeckSize: 60,
    sideboardSize: 15,
    copyLimit: 4,
    singleton: false,
    commanderRequired: false,
    colorIdentity: false,
    legalityKey: "vintage",
    banned: [],
    restricted: [],
  },
  {
    id: "casual",
    name: "Casual",
    deckSize: null,
    minDeckSize: null,
    sideboardSize: null,
    copyLimit: 0,
    singleton: false,
    commanderRequired: false,
    colorIdentity: false,
    legalityKey: "",
    banned: [],
    restricted: [],
  },
];

export function houseToRule(format: HouseFormat): FormatRule {
  return {
    id: `house:${format.id}`,
    name: format.name,
    deckSize: format.deckSize,
    minDeckSize: format.deckSize,
    sideboardSize: format.sideboardSize,
    copyLimit: format.copyLimit,
    singleton: format.singleton,
    commanderRequired: format.commanderRequired,
    colorIdentity: format.colorIdentity,
    legalityKey: format.legalityKey,
    banned: format.banned,
    restricted: format.restricted,
    house: true,
  };
}

export function resolveFormat(formatId: string, house: HouseFormat[] = []): FormatRule {
  const built = BUILTIN_FORMATS.find((f) => f.id === formatId);
  if (built) return built;
  const custom = house.find((f) => f.id === formatId || `house:${f.id}` === formatId);
  if (custom) return houseToRule(custom);
  return BUILTIN_FORMATS[0];
}
