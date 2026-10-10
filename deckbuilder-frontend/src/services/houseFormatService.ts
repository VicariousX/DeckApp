import type { HouseFormat } from "../lib/formats/rules";

const KEY = "deckapp-house-formats";

export function loadHouseFormats(): HouseFormat[] {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as HouseFormat[]) : [];
    return Array.isArray(list)
      ? list.map((f) => ({
          ...blankHouseFormat(),
          ...f,
          id: f.id,
          whitelist: f.whitelist ?? [],
          copyOverrides: f.copyOverrides ?? [],
          rules: f.rules ?? [],
          basedOn: f.basedOn ?? f.legalityKey ?? "commander",
        }))
      : [];
  } catch {
    return [];
  }
}

export function saveHouseFormats(formats: HouseFormat[]) {
  localStorage.setItem(KEY, JSON.stringify(formats));
}

export function blankHouseFormat(): HouseFormat {
  return {
    id: crypto.randomUUID(),
    name: "House format",
    basedOn: "commander",
    deckSize: 100,
    sideboardSize: 0,
    copyLimit: 1,
    singleton: true,
    commanderRequired: true,
    colorIdentity: true,
    legalityKey: "commander",
    banned: [],
    restricted: [],
    whitelist: [],
    copyOverrides: [],
    rules: [],
    notes: "",
    isPublic: false,
  };
}
