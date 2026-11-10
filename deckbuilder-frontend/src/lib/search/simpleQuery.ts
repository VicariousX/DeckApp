export type Logic = "and" | "or";
export type IdLogic = "and" | "or" | "commander";
export type StatField = "mv" | "edhrec";
export type StatOp = "=" | "<=" | ">=" | "<" | ">" | "!=";
export type StatChip = { field: StatField; op: StatOp; value: number };
export type Color = "W" | "U" | "B" | "R" | "G" | "C";

export type SimpleState = {
  name: string;
  idColors: Color[];
  idLogic: IdLogic;
  cardColors: Color[];
  cardLogic: Logic;
  types: string[];
  typeLogic: Logic;
  isCommander: boolean;
  oracle: string[];
  oracleLogic: Logic;
  stats: StatChip[];
  mechanic: string;
};

export function colorClause(prefix: "id" | "c", selected: Color[], logic: Logic | IdLogic): string {
  if (!selected.length && logic !== "commander") return "";
  if (logic === "commander") {
    const withC = selected.includes("C") ? selected : [...selected, "C" as Color];
    if (!withC.length) return "id:C";
    const parts = withC.map((c) => `${prefix}:${c}`);
    return parts.length > 1 ? `(${parts.join(" OR ")})` : parts[0];
  }
  if (logic === "and") return `${prefix}:${selected.join("")}`;
  const parts = selected.map((c) => `${prefix}:${c}`);
  return parts.length > 1 ? `(${parts.join(" OR ")})` : parts[0];
}

export function typeClause(types: string[], logic: Logic): string {
  if (!types.length) return "";
  const parts = types.map((t) => `t:${t.toLowerCase()}`);
  return parts.length > 1 ? `(${parts.join(logic === "or" ? " OR " : " ")})` : parts[0];
}

export function oracleClause(terms: string[], logic: Logic): string {
  if (!terms.length) return "";
  const parts = terms.map((t) => (t.includes(" ") ? `o:"${t}"` : `o:${t}`));
  return parts.length > 1 ? `(${parts.join(logic === "or" ? " OR " : " ")})` : parts[0];
}

export function buildSimpleQuery(s: SimpleState): string {
  const parts: string[] = [];
  if (s.name.trim()) parts.push(s.name.includes(" ") ? `name:"${s.name.trim()}"` : s.name.trim());
  const id = colorClause("id", s.idColors, s.idLogic);
  if (id) parts.push(id);
  const cc = colorClause("c", s.cardColors, s.cardLogic);
  if (cc) parts.push(cc);
  const tc = typeClause(s.types, s.typeLogic);
  if (tc) parts.push(tc);
  if (s.isCommander) parts.push("is:commander");
  const oc = oracleClause(s.oracle, s.oracleLogic);
  if (oc) parts.push(oc);
  for (const chip of s.stats) {
    const key = chip.field === "mv" ? "mv" : "edhrec";
    parts.push(`${key}${chip.op}${chip.value}`);
  }
  if (s.mechanic.trim()) parts.push(`mech:${s.mechanic.trim()}`);
  return parts.join(" ");
}

export function encodeSimpleState(s: SimpleState): string {
  return btoa(encodeURIComponent(JSON.stringify(s)));
}

export function decodeSimpleState(raw: string): SimpleState | null {
  try {
    return JSON.parse(decodeURIComponent(atob(raw))) as SimpleState;
  } catch {
    return null;
  }
}
