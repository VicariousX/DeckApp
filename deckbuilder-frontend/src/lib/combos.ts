export type ComboCard = {
  id: string;
  oracle_id: string;
  scryfall_id: string;
  name: string;
  type_line: string;
  image?: string;
};

export type ComboColumn = {
  id: string;
  label: string;
  face: number;
  cards: ComboCard[];
};

export type ComboLink = {
  a: string;
  b: string;
};

export type ComboLock = {
  id: string;
  name: string;
  columns: ComboColumn[];
  /** Cross-column pairs. Missing means every pair is linked. */
  links?: ComboLink[];
  updated_at: string;
};

export function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export function normalizeLink(a: string, b: string): ComboLink {
  return a < b ? { a, b } : { a: b, b: a };
}

export function defaultLinks(combo: ComboLock): ComboLink[] {
  const out: ComboLink[] = [];
  const seen = new Set<string>();
  const cols = combo.columns;
  for (let i = 0; i < cols.length; i++) {
    for (let j = i + 1; j < cols.length; j++) {
      for (const a of cols[i].cards) {
        for (const b of cols[j].cards) {
          const link = normalizeLink(a.oracle_id, b.oracle_id);
          const k = pairKey(link.a, link.b);
          if (seen.has(k) || link.a === link.b) continue;
          seen.add(k);
          out.push(link);
        }
      }
    }
  }
  return out;
}

export function resolvedLinks(combo: ComboLock): ComboLink[] {
  return combo.links ?? defaultLinks(combo);
}

export function isLinked(combo: ComboLock, a: string, b: string): boolean {
  if (a === b) return true;
  const k = pairKey(a, b);
  return resolvedLinks(combo).some((l) => pairKey(l.a, l.b) === k);
}

export function toggleLink(combo: ComboLock, a: string, b: string): ComboLock {
  const links = resolvedLinks(combo);
  const k = pairKey(a, b);
  const has = links.some((l) => pairKey(l.a, l.b) === k);
  return {
    ...combo,
    links: has
      ? links.filter((l) => pairKey(l.a, l.b) !== k)
      : [...links, normalizeLink(a, b)],
  };
}

export function linksForNewCard(combo: ComboLock, oracleId: string, colId: string): ComboLink[] {
  const base = resolvedLinks(combo);
  const seen = new Set(base.map((l) => pairKey(l.a, l.b)));
  const extra: ComboLink[] = [];
  for (const col of combo.columns) {
    if (col.id === colId) continue;
    for (const c of col.cards) {
      if (c.oracle_id === oracleId) continue;
      const k = pairKey(oracleId, c.oracle_id);
      if (seen.has(k)) continue;
      seen.add(k);
      extra.push(normalizeLink(oracleId, c.oracle_id));
    }
  }
  return [...base, ...extra];
}

export function pruneLinks(combo: ComboLock): ComboLock {
  const live = new Set(
    combo.columns.flatMap((c) => c.cards.map((x) => x.oracle_id))
  );
  const links = resolvedLinks(combo).filter(
    (l) => live.has(l.a) && live.has(l.b)
  );
  return { ...combo, links };
}

const PREFIX = "deckapp.combos.";

function key(userId: string | null): string {
  return PREFIX + (userId ?? "anon");
}

export function newColumn(label = ""): ComboColumn {
  return {
    id: `col-${crypto.randomUUID()}`,
    label,
    face: 0,
    cards: [],
  };
}

export function newCombo(name = "New combo"): ComboLock {
  return {
    id: `cmb-${crypto.randomUUID()}`,
    name,
    columns: [newColumn("Piece A"), newColumn("Piece B")],
    updated_at: new Date().toISOString(),
  };
}

export function loadCombos(userId: string | null): ComboLock[] {
  try {
    const raw = localStorage.getItem(key(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ComboLock[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCombos(userId: string | null, combos: ComboLock[]): void {
  try {
    localStorage.setItem(key(userId), JSON.stringify(combos));
  } catch {
    /* ignore quota */
  }
}

export function pairingCount(combo: ComboLock): number {
  return resolvedLinks(combo).length;
}
