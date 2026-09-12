/**
 * Parse pasted MTG card lists (Arena, Moxfield, Archidekt, plain text).
 * Modular: usable for drawers, decks, and future import tools.
 */

export type ParsedCardLine = {
  name: string;
  quantity: number;
  /** Optional set code if present, e.g. (M21) */
  setCode?: string;
  raw: string;
};

export type ParseCardListResult = {
  entries: ParsedCardLine[];
  /** Lines that looked like cards but failed to parse */
  skipped: string[];
};

const SECTION_RE =
  /^(sideboard|maybeboard|commander|deck|mainboard|main|companion|considerations)\s*:?\s*$/i;
const COMMENT_RE = /^\s*(#|\/\/)/;

/**
 * Strip trailing set/collector noise:
 * "Sol Ring (CMR)" / "Sol Ring (cmr) 123" / "Sol Ring [CMR]"
 */
function cleanName(rest: string): { name: string; setCode?: string } {
  let s = rest.trim();
  // Drop trailing bracket set codes
  s = s.replace(/\s*\[[^\]]+\]\s*$/i, "").trim();
  let setCode: string | undefined;
  const setMatch = s.match(/^(.*?)\s*\(([a-z0-9]{2,5})\)(?:\s+\d+)?\s*$/i);
  if (setMatch) {
    s = setMatch[1].trim();
    setCode = setMatch[2].toUpperCase();
  } else {
    // trailing collector number only
    s = s.replace(/\s+\d+\s*$/, "").trim();
  }
  // DFCs sometimes pasted with // — keep as-is (Scryfall accepts full name)
  return { name: s, setCode };
}

/**
 * Parse one logical line into a card entry, or null if not a card line.
 */
export function parseCardListLine(line: string): ParsedCardLine | null {
  const raw = line.trim();
  if (!raw) return null;
  if (COMMENT_RE.test(raw)) return null;
  if (SECTION_RE.test(raw)) return null;
  // Ignore pure separators
  if (/^[-=_]{3,}$/.test(raw)) return null;

  // Formats:
  // 1x Sol Ring
  // 1 Sol Ring
  // 4x Lightning Bolt (M21)
  // Sol Ring
  const qtyName = raw.match(/^(\d+)\s*[xX]?\s+(.+)$/);
  if (qtyName) {
    const quantity = Math.max(1, parseInt(qtyName[1], 10) || 1);
    const { name, setCode } = cleanName(qtyName[2]);
    if (!name) return null;
    return { name, quantity, setCode, raw };
  }

  const { name, setCode } = cleanName(raw);
  if (!name || name.length < 2) return null;
  // Avoid treating single numbers as names
  if (/^\d+$/.test(name)) return null;
  return { name, quantity: 1, setCode, raw };
}

export function parseCardList(text: string): ParseCardListResult {
  const entries: ParsedCardLine[] = [];
  const skipped: string[] = [];
  const lines = text.split(/\r?\n/);

  for (const line of lines) {
    if (!line.trim()) continue;
    if (COMMENT_RE.test(line.trim()) || SECTION_RE.test(line.trim())) continue;
    const parsed = parseCardListLine(line);
    if (parsed) entries.push(parsed);
    else if (line.trim()) skipped.push(line.trim());
  }

  return { entries, skipped };
}

/** Merge duplicate names (case-insensitive) by summing quantity. */
export function mergeParsedEntries(entries: ParsedCardLine[]): ParsedCardLine[] {
  const map = new Map<string, ParsedCardLine>();
  for (const e of entries) {
    const key = e.name.toLowerCase();
    const existing = map.get(key);
    if (existing) {
      existing.quantity += e.quantity;
    } else {
      map.set(key, { ...e });
    }
  }
  return [...map.values()];
}
