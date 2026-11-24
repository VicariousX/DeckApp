import type { ScryfallCard } from "../../types/scryfallCard";

type Tok = { kind: "lp" | "rp" | "or" | "and" | "not" | "word"; text: string };
type Pred = (card: ScryfallCard) => boolean;

function tokenize(q: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < q.length) {
    const c = q[i];
    if (/\s/.test(c)) {
      i += 1;
      continue;
    }
    if (c === "(") {
      out.push({ kind: "lp", text: "(" });
      i += 1;
      continue;
    }
    if (c === ")") {
      out.push({ kind: "rp", text: ")" });
      i += 1;
      continue;
    }
    if (c === '"') {
      let j = i + 1;
      while (j < q.length && q[j] !== '"') j += 1;
      out.push({ kind: "word", text: q.slice(i + 1, j) });
      i = j + 1;
      continue;
    }
    let j = i;
    while (j < q.length && !/[\s()"]/.test(q[j])) j += 1;
    const text = q.slice(i, j);
    const low = text.toLowerCase();
    if (low === "or") out.push({ kind: "or", text });
    else if (low === "and") out.push({ kind: "and", text });
    else if (text.startsWith("-") && text.length > 1) {
      out.push({ kind: "not", text: "-" });
      out.push({ kind: "word", text: text.slice(1) });
    } else out.push({ kind: "word", text });
    i = j;
  }
  return out;
}

function letters(raw: string): string[] {
  return [...raw.toUpperCase()].filter((c) => "WUBRG".includes(c));
}

function same(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((c) => b.includes(c));
}

function colorList(card: ScryfallCard, identity: boolean): string[] {
  const raw = identity
    ? card.color_identity ?? []
    : card.colors ?? card.card_faces?.flatMap((face) => face.colors ?? []) ?? [];
  return [...new Set(raw.map((c) => c.toUpperCase()))];
}

function colorPred(have: string[], op: string, raw: string): boolean | null {
  const want = raw.toUpperCase();
  if (want === "C") {
    if (op === ":" || op === "=") return have.length === 0;
    return null;
  }
  const need = letters(want);
  if (!need.length) return null;
  if (op === "=") return same(have, need);
  if (op === ":" || op === "<=") return have.every((c) => need.includes(c));
  if (op === "<") return have.every((c) => need.includes(c)) && have.length < need.length;
  if (op === ">=") return need.every((c) => have.includes(c));
  if (op === ">") return need.every((c) => have.includes(c)) && have.length > need.length;
  if (op === "!=") return !same(have, need);
  return null;
}

function textOf(card: ScryfallCard): string {
  return [card.oracle_text, ...(card.card_faces ?? []).map((face) => face.oracle_text)]
    .filter(Boolean)
    .join("\n")
    .toLowerCase();
}

function typeOf(card: ScryfallCard): string {
  return [card.type_line, ...(card.card_faces ?? []).map((face) => face.type_line)]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function predicate(text: string): Pred | null {
  const op = text.match(/^(.*?)(:|<=|>=|!=|=|<|>)([\s\S]*)$/);
  if (!op) {
    const needle = text.toLowerCase();
    if (!needle) return null;
    return (card) => card.name.toLowerCase().includes(needle);
  }
  const key = op[1].toLowerCase();
  const sign = op[2];
  const value = op[3];
  if (key === "id" || key === "c") {
    if (colorPred([], sign, value) === null && colorPred(["W"], sign, value) === null) return null;
    return (card) => colorPred(colorList(card, key === "id"), sign, value) === true;
  }
  if (key === "t") {
    const needle = value.toLowerCase();
    return (card) => typeOf(card).includes(needle);
  }
  if (key === "o") {
    const needle = value.toLowerCase();
    return (card) => textOf(card).includes(needle);
  }
  if (key === "name") {
    const needle = value.toLowerCase();
    return (card) => card.name.toLowerCase().includes(needle);
  }
  if (key === "is" && value.toLowerCase() === "commander") {
    return (card) => card.legalities?.commander === "legal";
  }
  if (key === "mv" || key === "cmc" || key === "edhrec") {
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    return (card) => {
      const current = key === "edhrec" ? card.edhrec_rank : card.cmc;
      if (typeof current !== "number") return false;
      if (sign === "<=") return current <= n;
      if (sign === ">=") return current >= n;
      if (sign === "<") return current < n;
      if (sign === ">") return current > n;
      if (sign === "!=") return current !== n;
      return current === n;
    };
  }
  return null;
}

/** Compile a simple Scryfall query. Null means the query needs the live API. */
export function compileQuery(q: string): Pred | null {
  const tokens = tokenize(q.trim());
  if (!tokens.length) return () => true;
  let i = 0;
  const peek = () => tokens[i];

  function unary(): Pred | null {
    if (peek()?.kind === "not") {
      i += 1;
      const inner = unary();
      return inner ? (card) => !inner(card) : null;
    }
    if (peek()?.kind === "lp") {
      i += 1;
      const inner = orExpr();
      if (!inner || peek()?.kind !== "rp") return null;
      i += 1;
      return inner;
    }
    const tok = peek();
    if (!tok || tok.kind !== "word") return null;
    i += 1;
    let text = tok.text;
    if (/[:<>=!]$/.test(text) && peek()?.kind === "word") {
      text += peek().text;
      i += 1;
    }
    return predicate(text);
  }

  function andExpr(): Pred | null {
    const first = unary();
    if (!first) return null;
    let left: Pred = first;
    while (peek() && peek().kind !== "or" && peek().kind !== "rp") {
      if (peek().kind === "and") i += 1;
      const right = unary();
      if (!right) return null;
      const keep: Pred = left;
      left = (card) => keep(card) && right(card);
    }
    return left;
  }

  function orExpr(): Pred | null {
    const first = andExpr();
    if (!first) return null;
    let left: Pred = first;
    while (peek()?.kind === "or") {
      i += 1;
      const right = andExpr();
      if (!right) return null;
      const keep: Pred = left;
      left = (card) => keep(card) || right(card);
    }
    return left;
  }

  const pred = orExpr();
  if (!pred || i !== tokens.length) return null;
  return pred;
}
