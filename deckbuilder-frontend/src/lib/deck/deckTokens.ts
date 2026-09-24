export type DeckToken = {
  id: string;
  name: string;
  quantity: number;
  source: "auto" | "manual";
  from?: string;
};

const STORE = "deckapp.deckTokens.";

const WORD_QTY: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
};

const TOKEN_RE =
  /\bcreates?\s+(?:(\d+|x|a|an|one|two|three|four|five|six|seven|eight|nine|ten)\s+)?([^.]{2,72}?)\s+tokens?\b/gi;

export function parseTokensFromOracle(
  oracle: string,
  fromCard: string
): DeckToken[] {
  const out: DeckToken[] = [];
  const text = oracle.replace(/\n/g, " ");
  let m: RegExpExecArray | null;
  const re = new RegExp(TOKEN_RE.source, "gi");
  while ((m = re.exec(text))) {
    const qtyRaw = (m[1] ?? "1").toLowerCase();
    const qty = qtyRaw === "x" ? 1 : WORD_QTY[qtyRaw] ?? parseInt(qtyRaw, 10) || 1;
    let body = m[2].trim();
    body = body.replace(/^(that are copies of|that's a copy of)\s+/i, "Copy of ");
    body = body.replace(/\s+/g, " ").replace(/[,;]+$/, "");
    if (/^token'?s? a copy/i.test(body)) body = "Copy";
    const name = titleToken(body);
    if (!name || name.length < 2) continue;
    out.push({
      id: `auto-${slug(name)}`,
      name,
      quantity: qty,
      source: "auto",
      from: fromCard,
    });
  }
  return out;
}

function titleToken(raw: string): string {
  const cleaned = raw
    .replace(/^(a|an|the)\s+/i, "")
    .replace(/\bwith\b.+$/i, "")
    .trim();
  if (!cleaned) return raw.trim();
  if (/treasure|food|clue|blood|map|powerstone|junk/i.test(cleaned) && cleaned.split(" ").length <= 3) {
    const noun = cleaned.replace(/^(?:\d+\/\d+\s+)?/i, "");
    return noun.replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return cleaned
    .split(" ")
    .map((w) => (w === w.toUpperCase() ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function mergeAutoTokens(auto: DeckToken[], manual: DeckToken[]): DeckToken[] {
  const byName = new Map<string, DeckToken>();
  for (const t of auto) {
    const key = t.name.toLowerCase();
    const prev = byName.get(key);
    if (prev) {
      prev.quantity = Math.max(prev.quantity, t.quantity);
      if (t.from && prev.from && !prev.from.includes(t.from)) {
        prev.from = `${prev.from}, ${t.from}`;
      }
    } else {
      byName.set(key, { ...t });
    }
  }
  for (const t of manual) {
    const key = t.name.toLowerCase();
    if (!byName.has(key)) byName.set(key, t);
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function loadDeckTokens(deckId: string): DeckToken[] {
  try {
    const raw = localStorage.getItem(STORE + deckId);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DeckToken[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveDeckTokens(deckId: string, tokens: DeckToken[]): void {
  try {
    localStorage.setItem(STORE + deckId, JSON.stringify(tokens));
  } catch {
    /* ignore */
  }
}
