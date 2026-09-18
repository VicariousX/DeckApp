import type { CmpOp } from "./syntaxModel";

export type FieldDef = {
  key: string;
  label: string;
  ops?: CmpOp[];
  hint?: string;
  kind?: "text" | "colors" | "select" | "number" | "flags";
  options?: { value: string; label: string }[];
};

export type CategoryDef = {
  id: string;
  label: string;
  fields: FieldDef[];
};

const CMP: CmpOp[] = [":", "=", ">", "<", ">=", "<="];
const COLON: CmpOp[] = [":", "="];

export const CATEGORIES: CategoryDef[] = [
  {
    id: "name",
    label: "Name",
    fields: [
      { key: "name", label: "Name", kind: "text", hint: 'Use !Exact for exact match' },
      { key: "", label: "Bare name", kind: "text" },
    ],
  },
  {
    id: "colors",
    label: "Colors & identity",
    fields: [
      { key: "c", label: "Color", kind: "colors", ops: CMP },
      { key: "id", label: "Identity", kind: "colors", ops: CMP },
      { key: "commander", label: "Commander", kind: "colors", ops: COLON },
    ],
  },
  {
    id: "type",
    label: "Type line",
    fields: [
      { key: "t", label: "Type", kind: "text", hint: "creature, legendary, elf…" },
    ],
  },
  {
    id: "text",
    label: "Oracle & flavor",
    fields: [
      { key: "o", label: "Oracle", kind: "text" },
      { key: "fo", label: "Full oracle", kind: "text" },
      { key: "kw", label: "Keyword", kind: "text" },
      { key: "ft", label: "Flavor", kind: "text" },
    ],
  },
  {
    id: "mana",
    label: "Mana",
    fields: [
      { key: "m", label: "Mana cost", kind: "text", ops: CMP, hint: "{G}{U} or 2WW" },
      { key: "mv", label: "Mana value", kind: "number", ops: CMP },
      { key: "produces", label: "Produces", kind: "colors", ops: CMP },
      { key: "devotion", label: "Devotion", kind: "text", ops: COLON },
    ],
  },
  {
    id: "stats",
    label: "Power / toughness / loyalty",
    fields: [
      { key: "pow", label: "Power", kind: "number", ops: CMP },
      { key: "tou", label: "Toughness", kind: "number", ops: CMP },
      { key: "pt", label: "P/T", kind: "text", ops: COLON },
      { key: "loy", label: "Loyalty", kind: "number", ops: CMP },
      { key: "def", label: "Defense", kind: "number", ops: CMP },
    ],
  },
  {
    id: "set",
    label: "Set & collector",
    fields: [
      { key: "s", label: "Set code", kind: "text" },
      { key: "cn", label: "Collector #", kind: "text", ops: CMP },
      { key: "block", label: "Block", kind: "text" },
      { key: "st", label: "Set type", kind: "text" },
      { key: "in", label: "Printed in", kind: "text" },
    ],
  },
  {
    id: "rarity",
    label: "Rarity",
    fields: [
      {
        key: "r",
        label: "Rarity",
        kind: "select",
        ops: CMP,
        options: [
          { value: "common", label: "Common" },
          { value: "uncommon", label: "Uncommon" },
          { value: "rare", label: "Rare" },
          { value: "mythic", label: "Mythic" },
          { value: "special", label: "Special" },
          { value: "bonus", label: "Bonus" },
        ],
      },
    ],
  },
  {
    id: "format",
    label: "Format & legality",
    fields: [
      { key: "f", label: "Legal in", kind: "text", hint: "commander, modern…" },
      { key: "banned", label: "Banned in", kind: "text" },
      { key: "restricted", label: "Restricted in", kind: "text" },
      { key: "cube", label: "Cube", kind: "text" },
    ],
  },
  {
    id: "prices",
    label: "Prices",
    fields: [
      { key: "usd", label: "USD", kind: "number", ops: CMP },
      { key: "eur", label: "EUR", kind: "number", ops: CMP },
      { key: "tix", label: "TIX", kind: "number", ops: CMP },
    ],
  },
  {
    id: "dates",
    label: "Dates",
    fields: [
      { key: "year", label: "Year", kind: "number", ops: CMP },
      { key: "date", label: "Released", kind: "text", ops: CMP, hint: "YYYY-MM-DD" },
    ],
  },
  {
    id: "artist",
    label: "Artist & art",
    fields: [
      { key: "a", label: "Artist", kind: "text" },
      { key: "atag", label: "Art tag", kind: "text" },
    ],
  },
  {
    id: "look",
    label: "Frame & finish",
    fields: [
      { key: "frame", label: "Frame", kind: "text" },
      { key: "border", label: "Border", kind: "select", options: [
        { value: "black", label: "Black" },
        { value: "white", label: "White" },
        { value: "silver", label: "Silver" },
        { value: "borderless", label: "Borderless" },
        { value: "gold", label: "Gold" },
      ]},
      { key: "watermark", label: "Watermark", kind: "text" },
    ],
  },
  {
    id: "flags",
    label: "Is / has / include",
    fields: [
      {
        key: "is",
        label: "Is",
        kind: "select",
        options: [
          "spell","permanent","historic","party","outlaw","vanilla","frenchvanilla",
          "bear","manland","hybrid","phyrexian","dfc","mdfc","split","flip","transform",
          "meld","leveler","modal","funny","promo","reprint","digital","foil","full",
          "textless","oversized","reserved","commander","default","latest","firstprint",
        ].map((v) => ({ value: v, label: v })),
      },
      {
        key: "has",
        label: "Has",
        kind: "select",
        options: ["indicator", "watermark", "flavor"].map((v) => ({ value: v, label: v })),
      },
      {
        key: "include",
        label: "Include",
        kind: "select",
        options: ["extras", "variations", "multilingual"].map((v) => ({ value: v, label: v })),
      },
      { key: "not", label: "Not (is)", kind: "text" },
    ],
  },
  {
    id: "game",
    label: "Game & language",
    fields: [
      { key: "game", label: "Game", kind: "select", options: [
        { value: "paper", label: "Paper" },
        { value: "arena", label: "Arena" },
        { value: "mtgo", label: "MTGO" },
      ]},
      { key: "lang", label: "Language", kind: "text" },
      { key: "unique", label: "Unique", kind: "select", options: [
        { value: "cards", label: "Cards" },
        { value: "art", label: "Art" },
        { value: "prints", label: "Prints" },
      ]},
    ],
  },
  {
    id: "custom",
    label: "Custom / unmatched",
    fields: [{ key: "", label: "Raw term", kind: "text" }],
  },
];

export const FIELD_TO_CATEGORY: Record<string, string> = (() => {
  const map: Record<string, string> = {
    color: "colors",
    identity: "colors",
    type: "type",
    oracle: "text",
    fulloracle: "text",
    keyword: "text",
    flavor: "text",
    mana: "mana",
    manavalue: "mana",
    power: "stats",
    toughness: "stats",
    powtou: "stats",
    loyalty: "stats",
    defense: "stats",
    set: "set",
    e: "set",
    number: "set",
    rarity: "rarity",
    format: "format",
    legal: "format",
    artist: "artist",
    released: "dates",
    usdfoil: "prices",
    language: "game",
  };
  for (const cat of CATEGORIES) {
    for (const f of cat.fields) {
      if (f.key) map[f.key] = cat.id;
    }
  }
  return map;
})();
