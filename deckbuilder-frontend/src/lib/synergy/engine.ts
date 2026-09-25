export type SynergyTagId =
  | "tokens"
  | "counters"
  | "sacrifice"
  | "graveyard"
  | "etb"
  | "draw"
  | "ramp"
  | "lifegain"
  | "damage"
  | "artifacts"
  | "enchantments"
  | "spells"
  | "aristocrats"
  | "flicker"
  | "treasure";

export type SynergyTag = {
  id: SynergyTagId;
  label: string;
};

export const SYNERGY_TAGS: SynergyTag[] = [
  { id: "tokens", label: "Tokens" },
  { id: "treasure", label: "Treasure" },
  { id: "counters", label: "+1/+1" },
  { id: "sacrifice", label: "Sacrifice" },
  { id: "aristocrats", label: "Aristocrats" },
  { id: "graveyard", label: "Graveyard" },
  { id: "etb", label: "ETB" },
  { id: "flicker", label: "Flicker" },
  { id: "draw", label: "Draw" },
  { id: "ramp", label: "Ramp" },
  { id: "lifegain", label: "Lifegain" },
  { id: "damage", label: "Damage" },
  { id: "artifacts", label: "Artifacts" },
  { id: "enchantments", label: "Enchantments" },
  { id: "spells", label: "Instants/Sorceries" },
];

const RULES: { id: SynergyTagId; test: (t: string, kw: string) => boolean }[] = [
  {
    id: "treasure",
    test: (t) => /treasure token|create[^\n.]{0,40}treasure/i.test(t),
  },
  {
    id: "tokens",
    test: (t) =>
      /create[s]?\s+(?:a|an|two|three|x|\d+)[^\n.]{0,50}token/i.test(t) ||
      /tokens? you control/i.test(t),
  },
  {
    id: "counters",
    test: (t) =>
      /\+1\/\+1 counter/i.test(t) ||
      /proliferate/i.test(t) ||
      /counters on/i.test(t),
  },
  {
    id: "sacrifice",
    test: (t) => /sacrifice (a|another|it|this|target)/i.test(t),
  },
  {
    id: "aristocrats",
    test: (t) =>
      /whenever .+ dies/i.test(t) ||
      /when .+ dies/i.test(t) ||
      /creature dying/i.test(t),
  },
  {
    id: "graveyard",
    test: (t) =>
      /from (a |your |an opponent.s )?graveyard/i.test(t) ||
      /mill |cards? into.+graveyard|return .+ from.+graveyard/i.test(t),
  },
  {
    id: "etb",
    test: (t) =>
      /enters( the battlefield)?/i.test(t) || /when .+ enters/i.test(t),
  },
  {
    id: "flicker",
    test: (t) =>
      /exile .+ then return/i.test(t) ||
      /blink/i.test(t) ||
      /phase out/i.test(t),
  },
  {
    id: "draw",
    test: (t) => /draw (a|two|three|x|\d+) cards?/i.test(t),
  },
  {
    id: "ramp",
    test: (t) =>
      /search your library for[^\n.]{0,40}land/i.test(t) ||
      /add \{[wubrgc0-9]/i.test(t) ||
      /you may play an additional land/i.test(t),
  },
  {
    id: "lifegain",
    test: (t) => /gain (a|\d+|x|life)/i.test(t) || /you gain life/i.test(t),
  },
  {
    id: "damage",
    test: (t) => /deals? \d+ damage|deal damage/i.test(t),
  },
  {
    id: "artifacts",
    test: (t, kw) =>
      /artifact/i.test(t) || /\bartifacts?\b/i.test(kw),
  },
  {
    id: "enchantments",
    test: (t) => /enchantment/i.test(t),
  },
  {
    id: "spells",
    test: (t) =>
      /instant or sorcery|cast (an? )?(instant|sorcery)/i.test(t),
  },
];

export type SynergyCard = {
  key: string;
  name: string;
  oracle: string;
  keywords?: string[];
};

export type TaggedCard = SynergyCard & { tags: SynergyTagId[] };

export function tagCard(card: SynergyCard): TaggedCard {
  const text = card.oracle || "";
  const kw = (card.keywords ?? []).join(" ");
  const tags = RULES.filter((r) => r.test(text, kw)).map((r) => r.id);
  return { ...card, tags: [...new Set(tags)] };
}

export type SynergyEdge = {
  a: string;
  b: string;
  tags: SynergyTagId[];
  weight: number;
};

export type CommunityMark = {
  key: string;
  mechanic: string;
  economy: "producer" | "payoff" | "both";
};

export function buildSynergyGraph(
  cards: SynergyCard[],
  minShared = 1,
  community: CommunityMark[] = []
): { nodes: TaggedCard[]; edges: SynergyEdge[] } {
  const nodes = cards.map(tagCard);
  const marks = new Map<string, CommunityMark[]>();
  for (const m of community) {
    const list = marks.get(m.key) ?? [];
    list.push(m);
    marks.set(m.key, list);
  }
  const edges: SynergyEdge[] = [];
  const seen = new Set<string>();
  function push(a: string, b: string, tag: string, weight: number) {
    const k = a < b ? `${a}|${b}|${tag}` : `${b}|${a}|${tag}`;
    if (seen.has(k)) return;
    seen.add(k);
    edges.push({ a, b, tags: [tag as SynergyTagId], weight });
  }
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const shared = nodes[i].tags.filter((t) => nodes[j].tags.includes(t));
      if (shared.length >= minShared) {
        for (const t of shared) push(nodes[i].key, nodes[j].key, t, shared.length);
      }
      for (const x of marks.get(nodes[i].key) ?? []) {
        for (const y of marks.get(nodes[j].key) ?? []) {
          if (x.mechanic !== y.mechanic) continue;
          const pair =
            x.economy === "both" ||
            y.economy === "both" ||
            (x.economy === "producer" && y.economy === "payoff") ||
            (x.economy === "payoff" && y.economy === "producer");
          push(nodes[i].key, nodes[j].key, x.mechanic, pair ? 3 : 1);
        }
      }
    }
  }
  return { nodes, edges };
}

export function tagCounts(nodes: TaggedCard[]): { id: SynergyTagId; label: string; count: number }[] {
  const map = new Map<SynergyTagId, number>();
  for (const n of nodes) for (const t of n.tags) map.set(t, (map.get(t) ?? 0) + 1);
  return SYNERGY_TAGS.map((t) => ({
    id: t.id,
    label: t.label,
    count: map.get(t.id) ?? 0,
  })).filter((t) => t.count > 0);
}

export function isolatedKeys(nodes: TaggedCard[], edges: SynergyEdge[]): string[] {
  const linked = new Set<string>();
  for (const e of edges) {
    linked.add(e.a);
    linked.add(e.b);
  }
  return nodes.filter((n) => !linked.has(n.key)).map((n) => n.key);
}
