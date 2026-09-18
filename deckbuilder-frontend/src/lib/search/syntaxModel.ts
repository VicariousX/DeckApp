export type JoinOp = "and" | "or";
export type CmpOp = ":" | "=" | ">" | "<" | ">=" | "<=" | "!=";

export type Clause = {
  kind: "clause";
  id: string;
  category: string;
  field: string;
  op: CmpOp;
  value: string;
  excluded: boolean;
};

export type Group = {
  kind: "group";
  id: string;
  join: JoinOp;
  items: Node[];
};

export type Node = Clause | Group;

export function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function emptyGroup(join: JoinOp = "and"): Group {
  return { kind: "group", id: uid(), join, items: [] };
}

export function emptyClause(category: string, field: string): Clause {
  return {
    kind: "clause",
    id: uid(),
    category,
    field,
    op: ":",
    value: "",
    excluded: false,
  };
}

function quoteIfNeeded(value: string): string {
  const v = value.trim();
  if (!v) return "";
  if (/^[!]/.test(v) && !v.includes(" ")) return v;
  if (/[:><=!()"]/.test(v) || /\s/.test(v)) {
    return `"${v.replace(/"/g, '\\"')}"`;
  }
  return v;
}

export function serializeClause(c: Clause): string {
  const val = quoteIfNeeded(c.value);
  if (!c.field && val) {
    return `${c.excluded ? "-" : ""}${val}`;
  }
  if (!c.field || !val) return "";
  const body = `${c.field}${c.op}${val}`;
  return c.excluded ? `-${body}` : body;
}

export function serializeNode(node: Node): string {
  if (node.kind === "clause") return serializeClause(node);
  const parts = node.items
    .map(serializeNode)
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 0) return "";
  const join = node.join === "or" ? " or " : " ";
  const inner = parts.join(join);
  return parts.length > 1 && node.join === "or" ? `(${inner})` : inner;
}

export function serializeQuery(root: Group): string {
  const parts = root.items.map(serializeNode).filter(Boolean);
  const join = root.join === "or" ? " or " : " ";
  const inner = parts.join(join);
  return root.join === "or" && parts.length > 1 ? `(${inner})` : inner;
}

type Tok =
  | { t: "lparen" }
  | { t: "rparen" }
  | { t: "or" }
  | { t: "term"; raw: string };

function tokenize(input: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  const s = input.trim();
  while (i < s.length) {
    const ch = s[i];
    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }
    if (ch === "(") {
      out.push({ t: "lparen" });
      i += 1;
      continue;
    }
    if (ch === ")") {
      out.push({ t: "rparen" });
      i += 1;
      continue;
    }
    if (/^or\b/i.test(s.slice(i)) && (i === 0 || /\s|\(/.test(s[i - 1] ?? " "))) {
      const after = s.slice(i + 2, i + 3);
      if (!after || /\s|\)/.test(after)) {
        out.push({ t: "or" });
        i += 2;
        continue;
      }
    }
    let raw = "";
    while (i < s.length) {
      const c = s[i];
      if (c === "(" || c === ")" || /\s/.test(c)) break;
      if (c === '"') {
        raw += c;
        i += 1;
        while (i < s.length && s[i] !== '"') {
          if (s[i] === "\\" && i + 1 < s.length) {
            raw += s[i] + s[i + 1];
            i += 2;
            continue;
          }
          raw += s[i];
          i += 1;
        }
        if (s[i] === '"') {
          raw += '"';
          i += 1;
        }
        continue;
      }
      raw += c;
      i += 1;
    }
    if (raw) out.push({ t: "term", raw });
  }
  return out;
}

function parseTerm(raw: string, fieldToCategory: Record<string, string>): Clause {
  let excluded = false;
  let body = raw;
  if (body.startsWith("-") && body.length > 1) {
    excluded = true;
    body = body.slice(1);
  }
  const m = body.match(/^([a-zA-Z][a-zA-Z0-9]*)(>=|<=|!=|=|:|>|<)(.+)$/);
  if (m) {
    const field = m[1].toLowerCase();
    const op = m[2] as CmpOp;
    let value = m[3];
    if (value.startsWith('"') && value.endsWith('"') && value.length >= 2) {
      value = value.slice(1, -1).replace(/\\"/g, '"');
    }
    return {
      kind: "clause",
      id: uid(),
      category: fieldToCategory[field] ?? "custom",
      field,
      op,
      value,
      excluded,
    };
  }
  let value = body;
  if (value.startsWith('"') && value.endsWith('"') && value.length >= 2) {
    value = value.slice(1, -1);
  }
  return {
    kind: "clause",
    id: uid(),
    category: "name",
    field: value.startsWith("!") ? "name" : "",
    op: ":",
    value,
    excluded,
  };
}

function parseSeq(
  tokens: Tok[],
  i: number,
  fieldToCategory: Record<string, string>
): { node: Group; next: number } {
  const group = emptyGroup("and");
  let join: JoinOp = "and";
  while (i < tokens.length) {
    const tok = tokens[i];
    if (tok.t === "rparen") break;
    if (tok.t === "or") {
      join = "or";
      group.join = "or";
      i += 1;
      continue;
    }
    if (tok.t === "lparen") {
      const inner = parseSeq(tokens, i + 1, fieldToCategory);
      group.items.push(inner.node);
      i = inner.next;
      if (tokens[i]?.t === "rparen") i += 1;
      continue;
    }
    if (tok.t === "term") {
      group.items.push(parseTerm(tok.raw, fieldToCategory));
      i += 1;
      continue;
    }
    i += 1;
  }
  if (join === "and") group.join = "and";
  return { node: group, next: i };
}

export function parseQuery(
  input: string,
  fieldToCategory: Record<string, string>
): Group {
  const tokens = tokenize(input);
  if (tokens.length === 0) return emptyGroup();
  return parseSeq(tokens, 0, fieldToCategory).node;
}

export function clausesIn(node: Node, category: string): Clause[] {
  if (node.kind === "clause") {
    return node.category === category ? [node] : [];
  }
  return node.items.flatMap((n) => clausesIn(n, category));
}

export function replaceCategory(root: Group, category: string, next: Group): Group {
  const stripped = stripCategory(root, category);
  if (next.items.length === 0) return stripped;
  return { ...stripped, items: [...stripped.items, next] };
}

function stripCategory(node: Group, category: string): Group {
  const items: Node[] = [];
  for (const n of node.items) {
    if (n.kind === "clause") {
      if (n.category !== category) items.push(n);
    } else {
      const inner = stripCategory(n, category);
      if (inner.items.length) items.push(inner);
    }
  }
  return { ...node, items };
}
