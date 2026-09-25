import { useMemo, useState } from "react";
import {
  SYNERGY_TAGS,
  buildSynergyGraph,
  isolatedKeys,
  tagCounts,
  type CommunityMark,
  type SynergyCard,
  type SynergyTagId,
} from "../lib/synergy/engine";
import styles from "./SynergyMap.module.css";

type Props = {
  cards: SynergyCard[];
  community?: CommunityMark[];
  extraEdges?: { a: string; b: string; label?: string }[];
  onSelect?: (key: string) => void;
};

type Pt = { x: number; y: number };

function layout(
  keys: string[],
  groups: Map<string, string>
): Record<string, Pt> {
  const buckets = new Map<string, string[]>();
  for (const k of keys) {
    const g = groups.get(k) ?? "_";
    const list = buckets.get(g) ?? [];
    list.push(k);
    buckets.set(g, list);
  }
  const names = [...buckets.keys()];
  const out: Record<string, Pt> = {};
  const R = 160;
  names.forEach((name, gi) => {
    const ang = (gi / Math.max(1, names.length)) * Math.PI * 2 - Math.PI / 2;
    const cx = 200 + Math.cos(ang) * R;
    const cy = 200 + Math.sin(ang) * R;
    const members = buckets.get(name) ?? [];
    members.forEach((key, i) => {
      const spread = (i - (members.length - 1) / 2) * 18;
      out[key] = {
        x: cx + Math.cos(ang + Math.PI / 2) * spread * 0.15,
        y: cy + spread * 0.35,
      };
    });
  });
  return out;
}

export function SynergyMap({ cards, community = [], extraEdges = [], onSelect }: Props) {
  const [filter, setFilter] = useState<SynergyTagId | "all">("all");
  const { nodes, edges } = useMemo(
    () => buildSynergyGraph(cards, 1, community),
    [cards, community]
  );
  const counts = useMemo(() => tagCounts(nodes), [nodes]);
  const lonely = useMemo(() => isolatedKeys(nodes, edges), [nodes, edges]);

  const visibleEdges = edges.filter((e) =>
    filter === "all" ? true : e.tags.includes(filter)
  );
  const used = new Set<string>();
  for (const e of visibleEdges) {
    used.add(e.a);
    used.add(e.b);
  }
  if (filter === "all") for (const n of nodes) used.add(n.key);

  const groups = new Map<string, string>();
  for (const n of nodes) groups.set(n.key, n.tags[0] ?? "_");
  const pts = layout([...used], groups);
  const byKey = new Map(nodes.map((n) => [n.key, n]));

  return (
    <div className={styles.wrap}>
      <div className={styles.filters}>
        <button
          type="button"
          className={filter === "all" ? styles.chipOn : styles.chip}
          onClick={() => setFilter("all")}
        >
          All
        </button>
        {counts.map((t) => (
          <button
            key={t.id}
            type="button"
            className={filter === t.id ? styles.chipOn : styles.chip}
            onClick={() => setFilter(t.id)}
          >
            {t.label} {t.count}
          </button>
        ))}
      </div>
      <svg className={styles.svg} viewBox="0 0 400 400" role="img">
        {extraEdges.map((e, i) => {
          const a = pts[e.a];
          const b = pts[e.b];
          if (!a || !b) return null;
          return (
            <line
              key={`x-${i}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              className={styles.lockEdge}
            />
          );
        })}
        {visibleEdges.map((e, i) => {
          const a = pts[e.a];
          const b = pts[e.b];
          if (!a || !b) return null;
          return (
            <line
              key={`${e.a}-${e.b}-${i}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              className={styles.edge}
              strokeOpacity={Math.min(0.85, 0.25 + e.weight * 0.2)}
            />
          );
        })}
        {nodes
          .filter((n) => used.has(n.key))
          .map((n) => {
            const p = pts[n.key];
            if (!p) return null;
            return (
              <g
                key={n.key}
                className={styles.node}
                onClick={() => onSelect?.(n.key)}
              >
                <circle cx={p.x} cy={p.y} r={7} />
                <text x={p.x + 9} y={p.y + 3}>
                  {n.name.length > 16 ? `${n.name.slice(0, 15)}…` : n.name}
                </text>
              </g>
            );
          })}
      </svg>
      <div className={styles.legend}>
        {counts.slice(0, 8).map((t) => (
          <span key={t.id}>
            {SYNERGY_TAGS.find((x) => x.id === t.id)?.label}: {t.count}
          </span>
        ))}
      </div>
      {filter === "all" && lonely.length > 0 && (
        <p className={styles.lonely}>
          Unlinked:{" "}
          {lonely
            .map((k) => byKey.get(k)?.name)
            .filter(Boolean)
            .slice(0, 8)
            .join(", ")}
          {lonely.length > 8 ? "…" : ""}
        </p>
      )}
    </div>
  );
}
