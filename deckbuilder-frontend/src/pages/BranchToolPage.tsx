import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchDeckDetail } from "../services/deckService";
import { branchTree, rememberBranchNode, type BranchNode } from "../services/deckHistory";
import { colorBalance, copies, manaCurve, typeCounts } from "../lib/deck/deckAnalytics";
import type { DeckCard, DeckDetail } from "../types/deck";
import styles from "./BranchToolPage.module.css";

type DiffRow = {
  key: string;
  name: string;
  board: string;
  left: number;
  right: number;
  kind: "added" | "removed" | "changed";
};

function rows(cards: DeckCard[]) {
  const map = new Map<string, DiffRow>();
  for (const card of cards) {
    const key = `${card.oracle_id}:${card.board}`;
    const current = map.get(key);
    if (current) current.left += card.quantity;
    else map.set(key, { key, name: card.name, board: card.board, left: card.quantity, right: 0, kind: "removed" });
  }
  return map;
}

function compare(left: DeckCard[], right: DeckCard[]): DiffRow[] {
  const map = rows(left);
  for (const card of right) {
    const key = `${card.oracle_id}:${card.board}`;
    const current = map.get(key);
    if (current) current.right += card.quantity;
    else map.set(key, { key, name: card.name, board: card.board, left: 0, right: card.quantity, kind: "added" });
  }
  return [...map.values()]
    .map((row) => ({
      ...row,
      kind: row.left === 0 ? "added" : row.right === 0 ? "removed" : "changed",
    }))
    .filter((row) => row.left !== row.right)
    .sort((a, b) => a.name.localeCompare(b.name));
}

function avgCmc(cards: DeckCard[]) {
  const playable = cards.filter((c) => !(c.type_line || "").toLowerCase().includes("land"));
  const n = copies(playable);
  if (!n) return 0;
  return playable.reduce((sum, c) => sum + (c.cmc || 0) * c.quantity, 0) / n;
}

export function BranchToolPage() {
  const { id } = useParams<{ id: string }>();
  const [nodes, setNodes] = useState<BranchNode[]>([]);
  const [leftId, setLeftId] = useState(id ?? "");
  const [rightId, setRightId] = useState("");
  const [left, setLeft] = useState<DeckDetail | null>(null);
  const [right, setRight] = useState<DeckDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    void fetchDeckDetail(id).then(({ detail }) => {
      if (detail) {
        rememberBranchNode({
          id: detail.deck.id,
          name: detail.deck.name,
          parentId: branchTree(id).find((n) => n.id === id)?.parentId ?? null,
          createdAt: detail.deck.created_at,
        });
      }
      const tree = branchTree(id);
      setNodes(tree);
      setLeftId(id);
      setRightId(tree.find((n) => n.id !== id)?.id ?? "");
    });
  }, [id]);

  useEffect(() => {
    if (!leftId || !rightId || leftId === rightId) return;
    setError(null);
    void Promise.all([fetchDeckDetail(leftId), fetchDeckDetail(rightId)]).then(([a, b]) => {
      setLeft(a.detail);
      setRight(b.detail);
      setError(a.error || b.error);
    });
  }, [leftId, rightId]);

  const diff = useMemo(() => compare(left?.cards ?? [], right?.cards ?? []), [left, right]);
  const insights = useMemo(() => {
    if (!left || !right) return [];
    const out: string[] = [];
    const cardDelta = copies(right.cards) - copies(left.cards);
    out.push(cardDelta === 0 ? "Same total card count." : `${cardDelta > 0 ? "+" : ""}${cardDelta} cards in ${right.deck.name}.`);
    const cmcDelta = avgCmc(right.cards) - avgCmc(left.cards);
    out.push(`Average nonland mana value ${cmcDelta >= 0 ? "up" : "down"} ${Math.abs(cmcDelta).toFixed(2)}.`);
    const leftColors = colorBalance(left.cards);
    const rightColors = colorBalance(right.cards);
    const colorShift = leftColors
      .map((c, i) => ({ color: c.color, delta: rightColors[i].count - c.count }))
      .filter((c) => c.delta !== 0)
      .map((c) => `${c.color} ${c.delta > 0 ? "+" : ""}${c.delta}`);
    out.push(colorShift.length ? `Color pips: ${colorShift.join(", ")}.` : "Color pip counts are unchanged.");
    const leftTypes = new Map(typeCounts(left.cards).map((t) => [t.label, t.count]));
    const rightTypes = new Map(typeCounts(right.cards).map((t) => [t.label, t.count]));
    const typeShift = [...new Set([...leftTypes.keys(), ...rightTypes.keys()])]
      .map((label) => ({ label, delta: (rightTypes.get(label) ?? 0) - (leftTypes.get(label) ?? 0) }))
      .filter((t) => t.delta !== 0)
      .map((t) => `${t.label} ${t.delta > 0 ? "+" : ""}${t.delta}`);
    out.push(typeShift.length ? `Types: ${typeShift.join(", ")}.` : "Type counts are unchanged.");
    const curve = manaCurve(right.cards).map((b, i) => b.count - manaCurve(left.cards)[i].count);
    const peak = curve.reduce((best, n, i) => (Math.abs(n) > Math.abs(curve[best]) ? i : best), 0);
    if (curve[peak]) out.push(`Largest curve shift is ${curve[peak] > 0 ? "+" : ""}${curve[peak]} at ${manaCurve(left.cards)[peak].bucket}.`);
    return out;
  }, [left, right]);

  return (
    <div className={styles.page}>
      <header>
        <h1>Branch tool</h1>
        <p>Pick two nodes. Added cards are green, removed cards are red, and quantity changes are amber.</p>
        <Link to={`/deck/${id}`}>Back to deck</Link>
      </header>
      {nodes.length < 2 && <p>No branches yet. Branch this deck from the header to start a tree.</p>}
      <div className={styles.layout}>
        <aside>
          <h2>Tree</h2>
          <ul>
            {nodes.map((node) => (
              <li key={node.id} style={{ marginLeft: node.parentId ? "1rem" : 0 }}>
                <button type="button" onClick={() => setLeftId(node.id)}>{leftId === node.id ? "Left" : "Set left"}</button>
                <button type="button" onClick={() => setRightId(node.id)}>{rightId === node.id ? "Right" : "Set right"}</button>
                <Link to={`/deck/${node.id}`}>{node.name}</Link>
              </li>
            ))}
          </ul>
        </aside>
        <section>
          <h2>{left?.deck.name ?? "Left"} vs {right?.deck.name ?? "Right"}</h2>
          {error && <p>{error}</p>}
          <ul className={styles.insights}>
            {insights.map((line) => <li key={line}>{line}</li>)}
          </ul>
          <ul className={styles.diff}>
            {diff.map((row) => (
              <li key={row.key} className={styles[row.kind]}>
                <span>{row.name}</span>
                <span>{row.board}</span>
                <span>{row.left} → {row.right}</span>
              </li>
            ))}
          </ul>
          {left && right && diff.length === 0 && <p>These nodes have the same cards and quantities.</p>}
        </section>
      </div>
    </div>
  );
}
