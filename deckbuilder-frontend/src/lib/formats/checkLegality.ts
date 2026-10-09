import type { DeckCard } from "../../types/deck";
import type { FormatRule } from "./rules";

export type CardLegality = {
  legalities?: Record<string, string>;
  color_identity?: string[];
  type_line?: string;
};

export type LegalityIssue = {
  level: "error" | "warn";
  code: string;
  message: string;
  oracleId?: string;
};

const BASIC = new Set([
  "plains",
  "island",
  "swamp",
  "mountain",
  "forest",
  "wastes",
  "snow-covered plains",
  "snow-covered island",
  "snow-covered swamp",
  "snow-covered mountain",
  "snow-covered forest",
]);

const ANY_NUMBER = new Set([
  "relentless rats",
  "shadowborn apostle",
  "rat colony",
  "persistent petitioners",
  "dragon's approach",
  "slime against humanity",
]);

const COPY_CAP: Record<string, number> = {
  "seven dwarves": 7,
  nazgûl: 9,
  nazgul: 9,
};

function isBasic(name: string, typeLine: string) {
  return BASIC.has(name.toLowerCase()) || /\bbasic\b/i.test(typeLine);
}

function capFor(name: string, rule: FormatRule) {
  const key = name.toLowerCase();
  if (isBasic(name, "")) return 0;
  if (ANY_NUMBER.has(key)) return 0;
  if (COPY_CAP[key]) return COPY_CAP[key];
  if (rule.singleton) return 1;
  return rule.copyLimit;
}

export function checkDeck(
  cards: DeckCard[],
  rule: FormatRule,
  byOracle: Record<string, CardLegality>
): LegalityIssue[] {
  const issues: LegalityIssue[] = [];
  const main = cards.filter((c) => c.board === "main" || c.board === "commander");
  const side = cards.filter((c) => c.board === "side");
  const commanders = cards.filter((c) => c.board === "commander");
  const mainCount = main.reduce((n, c) => n + c.quantity, 0);
  const sideCount = side.reduce((n, c) => n + c.quantity, 0);

  if (rule.deckSize != null && mainCount !== rule.deckSize) {
    issues.push({
      level: "error",
      code: "size",
      message: `${rule.name} wants ${rule.deckSize} cards. This deck has ${mainCount}.`,
    });
  } else if (rule.minDeckSize != null && mainCount < rule.minDeckSize && mainCount > 0) {
    issues.push({
      level: "warn",
      code: "size",
      message: `${rule.name} wants at least ${rule.minDeckSize} cards. This deck has ${mainCount}.`,
    });
  }
  if (rule.sideboardSize != null && sideCount > rule.sideboardSize) {
    issues.push({
      level: "error",
      code: "side",
      message: `Sideboard has ${sideCount}. ${rule.name} allows ${rule.sideboardSize}.`,
    });
  }
  if (rule.commanderRequired && commanders.length === 0 && mainCount > 0) {
    issues.push({
      level: "error",
      code: "commander",
      message: "No commander on the commander board.",
    });
  }
  if (commanders.length > 2) {
    issues.push({
      level: "warn",
      code: "commander",
      message: "More than two cards on the commander board.",
    });
  }

  const identity = new Set<string>();
  for (const cmd of commanders) {
    const info = byOracle[cmd.oracle_id.toLowerCase()];
    for (const letter of info?.color_identity || []) identity.add(letter.toUpperCase());
  }

  const copies = new Map<string, { name: string; qty: number; oracleId: string }>();
  for (const card of cards) {
    if (card.board === "maybe") continue;
    const key = card.oracle_id.toLowerCase();
    const row = copies.get(key) || { name: card.name, qty: 0, oracleId: key };
    row.qty += card.quantity;
    copies.set(key, row);
  }
  for (const row of copies.values()) {
    const info = byOracle[row.oracleId];
    const cap = isBasic(row.name, info?.type_line || "") ? 0 : capFor(row.name, rule);
    if (cap > 0 && row.qty > cap) {
      issues.push({
        level: "error",
        code: "copies",
        oracleId: row.oracleId,
        message: `${row.name} has ${row.qty} copies. Limit is ${cap}.`,
      });
    }
    const status = rule.legalityKey ? info?.legalities?.[rule.legalityKey] : "";
    if (status === "banned" || rule.banned.some((n) => n.toLowerCase() === row.name.toLowerCase())) {
      issues.push({
        level: "error",
        code: "banned",
        oracleId: row.oracleId,
        message: `${row.name} is banned in ${rule.name}.`,
      });
    }
    if (status === "not_legal") {
      issues.push({
        level: "error",
        code: "illegal",
        oracleId: row.oracleId,
        message: `${row.name} is not legal in ${rule.name}.`,
      });
    }
    if (status === "restricted" || rule.restricted.some((n) => n.toLowerCase() === row.name.toLowerCase())) {
      if (row.qty > 1) {
        issues.push({
          level: "error",
          code: "restricted",
          oracleId: row.oracleId,
          message: `${row.name} is restricted to one copy.`,
        });
      }
    }
    if (rule.colorIdentity && commanders.length > 0 && identity.size >= 0) {
      const colors = (info?.color_identity || []).map((c) => c.toUpperCase());
      const outside = colors.filter((c) => !identity.has(c));
      if (outside.length > 0 && !commanders.some((c) => c.oracle_id.toLowerCase() === row.oracleId)) {
        issues.push({
          level: "error",
          code: "identity",
          oracleId: row.oracleId,
          message: `${row.name} is outside the commander color identity.`,
        });
      }
    }
  }

  return issues;
}
