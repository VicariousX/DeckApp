import type { Economy } from "./catalog";
import { mechanicById } from "./catalog";

export type MechTerm = {
  id: string;
  economy?: Economy;
  negate?: boolean;
};

export function extractMechanicTerms(q: string): {
  rest: string;
  terms: MechTerm[];
} {
  const terms: MechTerm[] = [];
  const rest = q
    .replace(
      /(?:^|\s)(-)?mech:([a-z0-9-]+)(?::(producer|payoff|both))?/gi,
      (_, neg, id, eco) => {
        const def = mechanicById(String(id).toLowerCase());
        if (def) {
          terms.push({
            id: def.id,
            economy: eco as Economy | undefined,
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
