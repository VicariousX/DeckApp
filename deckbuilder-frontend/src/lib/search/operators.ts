import type { CmpOp } from "./syntaxModel";

export const OP_LABELS: { op: CmpOp; label: string }[] = [
  { op: ":", label: "matches" },
  { op: "=", label: "exactly" },
  { op: ">", label: "more than" },
  { op: "<", label: "less than" },
  { op: ">=", label: "at least" },
  { op: "<=", label: "up to and including" },
  { op: "!=", label: "not equal to" },
];
