import type { Agency } from "./catalog";
import { mechanicById } from "./catalog";

export type MechTerm = {
  id: string;
  relation?: Agency;
  negate?: boolean;
};

function asRelation(raw: string | undefined): Agency | undefined {
  if (!raw) return undefined;
  const v = raw.toLowerCase();
  if (v === "cause" || v === "producer") return "cause";
  if (v === "benefit" || v === "payoff") return "benefit";
  if (v === "both") return "both";
  return undefined;
}

export function extractMechanicTerms(q: string): {
  rest: string;
  terms: MechTerm[];
} {
  const terms: MechTerm[] = [];
  const rest = q
    .replace(
      /(?:^|\s)(-)?mech:([a-z0-9-]+)(?::(cause|benefit|both|producer|payoff))?/gi,
      (_, neg, id, rel) => {
        const def = mechanicById(String(id).toLowerCase());
        if (def) {
          terms.push({
            id: def.id,
            relation: asRelation(rel),
            negate: Boolean(neg),
          });
        }
        return " ";
      }
    )
    .replace(/\s+/g, " ")
    .trim();
  return { rest, terms };
}
