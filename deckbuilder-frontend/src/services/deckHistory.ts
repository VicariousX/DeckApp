import type { DeckCard } from "../types/deck";

export type DeckSnapshot = {
  at: string;
  label: string;
  cards: Pick<
    DeckCard,
    "oracle_id" | "scryfall_id" | "name" | "type_line" | "mana_cost" | "cmc" | "quantity" | "board"
  >[];
};

export type BranchNode = {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: string;
};

const MAX = 12;
const BRANCH_KEY = "deckapp-branches";

function key(deckId: string) {
  return `deckapp-history:${deckId}`;
}

export function loadHistory(deckId: string): DeckSnapshot[] {
  try {
    const raw = localStorage.getItem(key(deckId));
    const list = raw ? (JSON.parse(raw) as DeckSnapshot[]) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function rememberDeck(deckId: string, cards: DeckCard[], label: string) {
  const snap: DeckSnapshot = {
    at: new Date().toISOString(),
    label,
    cards: cards.map((c) => ({
      oracle_id: c.oracle_id,
      scryfall_id: c.scryfall_id,
      name: c.name,
      type_line: c.type_line,
      mana_cost: c.mana_cost,
      cmc: c.cmc,
      quantity: c.quantity,
      board: c.board,
    })),
  };
  const next = [snap, ...loadHistory(deckId)].slice(0, MAX);
  localStorage.setItem(key(deckId), JSON.stringify(next));
}

function readNodes(): Record<string, BranchNode> {
  try {
    const raw = JSON.parse(localStorage.getItem(BRANCH_KEY) || "{}") as Record<string, BranchNode | string>;
    const nodes: Record<string, BranchNode> = {};
    for (const [id, value] of Object.entries(raw)) {
      if (typeof value === "string") {
        nodes[id] = { id, name: "Branch", parentId: value, createdAt: "" };
      } else if (value && typeof value === "object" && value.parentId !== undefined) {
        nodes[id] = {
          id,
          name: value.name || "Branch",
          parentId: value.parentId,
          createdAt: value.createdAt || "",
        };
      }
    }
    return nodes;
  } catch {
    return {};
  }
}

function writeNodes(nodes: Record<string, BranchNode>) {
  localStorage.setItem(BRANCH_KEY, JSON.stringify(nodes));
}

export function loadBranchParent(deckId: string): string | null {
  return readNodes()[deckId]?.parentId ?? null;
}

export function rememberBranchNode(node: BranchNode) {
  const nodes = readNodes();
  nodes[node.id] = node;
  writeNodes(nodes);
}

export function saveBranchParent(deckId: string, parentId: string, name = "Branch") {
  rememberBranchNode({
    id: deckId,
    name,
    parentId,
    createdAt: new Date().toISOString(),
  });
}

export function hasBranches(deckId: string): boolean {
  const nodes = readNodes();
  if (nodes[deckId]?.parentId) return true;
  return Object.values(nodes).some((node) => node.parentId === deckId);
}

export function branchTree(deckId: string): BranchNode[] {
  const nodes = readNodes();
  const seen = new Set<string>();
  let cursor: string | null = deckId;
  while (cursor && !seen.has(cursor)) {
    seen.add(cursor);
    cursor = nodes[cursor]?.parentId ?? null;
  }
  const root = [...seen].find((id) => !nodes[id]?.parentId) ?? deckId;
  const ordered: string[] = [];
  const walk = (id: string) => {
    if (ordered.includes(id)) return;
    ordered.push(id);
    for (const node of Object.values(nodes)) {
      if (node.parentId === id) walk(node.id);
    }
  };
  walk(root);
  return ordered.map((id) => nodes[id] ?? { id, name: id === deckId ? "This deck" : "Deck", parentId: null, createdAt: "" });
}
