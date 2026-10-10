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

type Filter = "all" | "added" | "removed" | "changed";

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
    .map((row): DiffRow => ({
      ...row,
      kind: row.left === 0 ? "added" : row.right === 0 ? "removed" : "changed",
    }))
    .filter((row) => row.left !== row.right)
    .sort((a, b) => a.board.localeCompare(b.board) || a.name.localeCompare(b.name));
}

function avgCmc(cards: DeckCard[]) {
  const playable = cards.filter((c) => !(c.type_line || "").toLowerCase().includes("land"));
  const n = copies(playable);
  if (!n) return 0;
  return playable.reduce((sum, c) => sum + (c.cmc || 0) * c.quantity, 0) / n;
}

function CompareBar({ label, left, right, max }: { label: string; left: number; right: number; max: number }) {
  const scale = Math.max(1, max);
  return (
    <div className={styles.compareBar}>
      <span className={styles.barLabel}>{label}</span>
      <div className={styles.barTrack}>
        <span className={styles.barLeft} style={{ width: `${(left / scale) * 50}%` }} />
        <span className={styles.barCenter} />
        <span className={styles.barRight} style={{ width: `${(right / scale) * 50}%` }} />
      </div>
      <em>{left} · {right}</em>
    </div>
  );
}

function depthOf(node: BranchNode, nodes: BranchNode[]) {
  let depth = 0;
  let parent = node.parentId;
  const seen = new Set<string>();
  while (parent && !seen.has(parent)) {
    seen.add(parent);
    depth += 1;
    parent = nodes.find((n) => n.id === parent)?.parentId ?? null;
  }
  return depth;
}

export function BranchToolPage() {
  const { id } = useParams<{ id: string }>();
  const [nodes, setNodes] = useState<BranchNode[]>([]);
  const [leftId, setLeftId] = useState(id ?? "");
  const [rightId, setRightId] = useState("");
  const [slot, setSlot] = useState<"left" | "right">("right");
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [left, setLeft] = useState<DeckDetail | null>(null);
  const [right, setRight] = useState<DeckDetail | null>(null);
  const [loading, setLoading] = useState(false);
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
    if (!leftId || !rightId || leftId === rightId) {
      setLeft(null);
      setRight(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void Promise.all([fetchDeckDetail(leftId), fetchDeckDetail(rightId)]).then(([a, b]) => {
      if (cancelled) return;
      setLeft(a.detail);
      setRight(b.detail);
      setError(a.error || b.error);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [leftId, rightId]);

  const diff = useMemo(() => compare(left?.cards ?? [], right?.cards ?? []), [left, right]);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return diff.filter((row) => (filter === "all" || row.kind === filter) && (!q || row.name.toLowerCase().includes(q)));
  }, [diff, filter, query]);
  const counts = {
    added: diff.filter((r) => r.kind === "added").length,
    removed: diff.filter((r) => r.kind === "removed").length,
    changed: diff.filter((r) => r.kind === "changed").length,
  };
  const insights = useMemo(() => {
    if (!left || !right) return [];
    const cardDelta = copies(right.cards) - copies(left.cards);
    const cmcDelta = avgCmc(right.cards) - avgCmc(left.cards);
    return [
      { label: "Cards", value: `${cardDelta > 0 ? "+" : ""}${cardDelta}`, note: `${copies(left.cards)} → ${copies(right.cards)}` },
      { label: "Avg MV", value: `${cmcDelta >= 0 ? "+" : ""}${cmcDelta.toFixed(2)}`, note: "Nonland cards" },
      { label: "Added", value: String(counts.added), note: "New rows" },
      { label: "Removed", value: String(counts.removed), note: "Missing rows" },
    ];
  }, [left, right, counts.added, counts.removed]);
  const curve = useMemo(() => {
    if (!left || !right) return [];
    const a = manaCurve(left.cards);
    const b = manaCurve(right.cards);
    return a.map((bin, i) => ({ bucket: bin.bucket, left: bin.count, right: b[i].count }));
  }, [left, right]);
  const colors = useMemo(() => {
    if (!left || !right) return [];
    const a = colorBalance(left.cards);
    const b = colorBalance(right.cards);
    return a.map((c, i) => ({ color: c.color, left: c.count, right: b[i].count }));
  }, [left, right]);
  const types = useMemo(() => {
    if (!left || !right) return [];
    const a = new Map(typeCounts(left.cards).map((t) => [t.label, t.count]));
    const b = new Map(typeCounts(right.cards).map((t) => [t.label, t.count]));
    return [...new Set([...a.keys(), ...b.keys()])].map((label) => ({
      label,
      left: a.get(label) ?? 0,
      right: b.get(label) ?? 0,
    }));
  }, [left, right]);

  function pick(nodeId: string) {
    if (slot === "left") setLeftId(nodeId);
    else setRightId(nodeId);
    setSlot(slot === "left" ? "right" : "left");
  }

  const leftName = nodes.find((n) => n.id === leftId)?.name ?? "Choose left";
  const rightName = nodes.find((n) => n.id === rightId)?.name ?? "Choose right";

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>Comparison</p>
          <h1>Branch tool</h1>
          <p>Select two nodes. The tree assigns the next open slot, and the list shows only what changed.</p>
        </div>
        <Link className={styles.back} to={`/deck/${id}`}>Back to deck</Link>
      </header>

      <div className={styles.slots}>
        <button type="button" className={`${styles.slot} ${slot === "left" ? styles.slotActive : ""}`} onClick={() => setSlot("left")}>
          <span>Left</span>
          <strong>{leftName}</strong>
        </button>
        <button type="button" className={styles.swap} onClick={() => { setLeftId(rightId); setRightId(leftId); }} disabled={!rightId}>Swap</button>
        <button type="button" className={`${styles.slot} ${slot === "right" ? styles.slotActive : ""}`} onClick={() => setSlot("right")}>
          <span>Right</span>
          <strong>{rightName}</strong>
        </button>
      </div>

      {nodes.length < 2 && (
        <div className={styles.empty}>
          <h2>No branches yet</h2>
          <p>Branch this deck from the header. The new copy stays linked so it can be compared here.</p>
          <Link to={`/deck/${id}`}>Return to deck</Link>
        </div>
      )}

      <div className={styles.layout}>
        <aside className={styles.tree}>
          <h2>Tree</h2>
          <p>Click a node to fill the highlighted slot.</p>
          <ul>
            {nodes.map((node) => (
              <li key={node.id} style={{ marginLeft: `${depthOf(node, nodes) * 16}px` }}>
                <button
                  type="button"
                  className={`${styles.node} ${node.id === id ? styles.current : ""} ${node.id === leftId ? styles.leftNode : ""} ${node.id === rightId ? styles.rightNode : ""}`}
                  onClick={() => pick(node.id)}
                >
                  <span className={styles.nodeName}>{node.name}</span>
                  <span className={styles.nodeMeta}>
                    {node.id === id ? "Current" : node.parentId ? "Branch" : "Root"}
                    {node.id === leftId ? " · L" : ""}
                    {node.id === rightId ? " · R" : ""}
                  </span>
                </button>
                <Link to={`/deck/${node.id}`}>Open</Link>
              </li>
            ))}
          </ul>
        </aside>

        <section className={styles.compare}>
          <div className={styles.compareHead}>
            <h2>{leftName} vs {rightName}</h2>
            {left && right && <span>{visible.length} shown</span>}
          </div>
          {leftId === rightId && <p className={styles.warn}>Pick two different nodes.</p>}
          {error && <p className={styles.warn}>{error}</p>}
          {loading && <p>Loading comparison…</p>}

          {left && right && (
            <>
              <div className={styles.metrics}>
                {insights.map((item) => (
                  <article key={item.label}>
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                    <small>{item.note}</small>
                  </article>
                ))}
              </div>

              <div className={styles.charts}>
                <div>
                  <h3>Mana curve</h3>
                  <p className={styles.legend}><i /> Left <b /> Right</p>
                  {curve.map((bin) => (
                    <CompareBar key={bin.bucket} label={bin.bucket} left={bin.left} right={bin.right} max={Math.max(1, ...curve.flatMap((c) => [c.left, c.right]))} />
                  ))}
                </div>
                <div>
                  <h3>Colors and types</h3>
                  <p className={styles.legend}><i /> Left <b /> Right</p>
                  {colors.map((c) => (
                    <CompareBar key={c.color} label={c.color} left={c.left} right={c.right} max={Math.max(1, ...colors.flatMap((x) => [x.left, x.right]), ...types.flatMap((x) => [x.left, x.right]))} />
                  ))}
                  {types.map((t) => (
                    <CompareBar key={t.label} label={t.label} left={t.left} right={t.right} max={Math.max(1, ...colors.flatMap((x) => [x.left, x.right]), ...types.flatMap((x) => [x.left, x.right]))} />
                  ))}
                </div>
              </div>

              <div className={styles.filters}>
                {(["all", "added", "removed", "changed"] as Filter[]).map((item) => (
                  <button key={item} type="button" className={filter === item ? styles.filterOn : ""} onClick={() => setFilter(item)}>
                    {item} {item === "all" ? diff.length : counts[item]}
                  </button>
                ))}
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter cards" />
              </div>

              <ul className={styles.diff}>
                {visible.map((row) => (
                  <li key={row.key} className={styles[row.kind]}>
                    <span className={styles.kind}>{row.kind}</span>
                    <strong>{row.name}</strong>
                    <span>{row.board}</span>
                    <span>{row.left} → {row.right}</span>
                  </li>
                ))}
              </ul>
              {visible.length === 0 && <p className={styles.warn}>No rows match this filter.</p>}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
