export type OracleLine =
  | { kind: "face"; text: string }
  | { kind: "rule"; text: string; index: number };

export type OracleQuote = { text: string; index: number };

const STOP = new Set([
  "the", "and", "for", "with", "from", "that", "this", "your", "you", "its",
  "into", "onto", "cards", "card", "matter", "triggers", "trigger", "like",
  "style", "tokens", "token", "counters", "counter", "abilities", "ability",
  "including", "other", "when", "then", "about", "care", "cares", "permanent",
  "permanents", "creature", "creatures", "spell", "spells", "target", "each",
  "all", "more", "than", "their", "they", "have", "has", "any",
]);

/** Printed words for catalog ids whose names are jargon, not rules text. */
const ALIASES: Record<string, string[]> = {
  etb: ["enter"],
  ltb: ["leaves the battlefield"],
  rocks: ["add {", "{t}: add"],
  dorks: ["add {", "{t}: add"],
  ramp: ["search your library for", "additional land"],
  ritual: ["add {"],
  aristocrats: ["dies", "sacrifice"],
  blink: ["exile"],
  flicker: ["exile"],
  bounce: ["owner's hand", "your hand", "their hand"],
  "gy-fill": ["mill"],
  "gy-recur": ["graveyard"],
  reanimate: ["graveyard"],
  impulse: ["you may play", "you may cast"],
  wheels: ["discard your hand"],
  landfall: ["land enter"],
  "lands-matter": ["land"],
  fetch: ["search your library"],
  "cost-reduce": ["cost"],
  "combat-trigger": ["attack", "combat damage"],
  "extra-combat": ["additional combat"],
  evasion: ["can't be blocked"],
  connect: ["combat damage"],
  "direct-damage": ["damage"],
  burn: ["damage"],
  ping: ["deals 1 damage"],
  lifegain: ["gain life"],
  lifeloss: ["lose life"],
  drain: ["lose life", "gain life"],
  enchantress: ["enchantment"],
  pw: ["loyalty"],
  spellslinger: ["instant", "sorcery"],
  removal: ["destroy target", "exile target"],
  wipe: ["destroy all", "exile all"],
  theft: ["gain control"],
  "tap-untap": ["untap"],
  "creature-tokens": ["token"],
  "token-copy": ["copy"],
  cantrip: ["draw a card"],
  modal: ["choose one", "choose two"],
  "x-spell": ["{x}"],
  "copy-spell": ["copy"],
  "copy-creature": ["copy"],
  "copy-permanent": ["copy"],
  fog: ["prevent"],
  tax: ["cost"],
  "gy-hate": ["graveyard"],
  tribal: ["creature type"],
  "extra-lands": ["additional land"],
  "extra-turn": ["extra turn"],
  topdeck: ["top of"],
  "bottom-library": ["bottom"],
  "hand-size": ["hand size"],
  hellbent: ["no cards in hand"],
  "discard-matters": ["discard"],
  plus1: ["+1/+1"],
  minus1: ["-1/-1"],
  energy: ["{e}"],
  tutor: ["search your library"],
  fight: ["fight"],
  "land-destruction": ["land"],
  domain: ["basic land type"],
  "lifelink-matter": ["life total"],
};

export function oracleLines(text: string): OracleLine[] {
  const lines: OracleLine[] = [];
  let index = 0;
  for (const raw of text.split(/\n+/)) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("//")) {
      lines.push({ kind: "face", text: line.replace(/^\/\/\s*/, "") });
      continue;
    }
    lines.push({ kind: "rule", text: line, index: index++ });
  }
  return lines;
}

function nameNeedles(name: string): string[] {
  const out: string[] = [];
  for (const segment of name.toLowerCase().split("/")) {
    const phrase = segment.trim();
    if (phrase.length >= 4 && !STOP.has(phrase)) out.push(phrase);
    for (const word of phrase.split(/[^a-z0-9+]+/)) {
      if (word.length >= 4 && !STOP.has(word)) out.push(word);
    }
  }
  return out;
}

function matches(haystack: string, needle: string): boolean {
  const n = needle.trim().toLowerCase();
  if (!n) return false;
  if (/[^a-z0-9\s]/.test(n)) return haystack.toLowerCase().includes(n);
  const body = n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[^a-z0-9])${body}s?(?:$|[^a-z0-9])`, "i").test(haystack);
}

export function quoteForMechanic(
  text: string,
  mechanic: { id: string; name: string }
): OracleQuote | null {
  const rules = oracleLines(text).filter((line): line is Extract<OracleLine, { kind: "rule" }> => line.kind === "rule");
  if (rules.length === 0) return null;
  const needles = [...new Set([...nameNeedles(mechanic.name), ...(ALIASES[mechanic.id] ?? [])])];
  if (needles.length === 0) return null;

  let best: OracleQuote | null = null;
  let bestScore = 0;
  for (const line of rules) {
    let score = 0;
    for (const needle of needles) {
      if (matches(line.text, needle)) score += Math.min(12, Math.max(4, needle.length));
    }
    if (score === 0) continue;
    if (
      score > bestScore ||
      (score === bestScore && best != null && line.text.length < best.text.length)
    ) {
      bestScore = score;
      best = { text: line.text, index: line.index };
    }
  }
  return best;
}
