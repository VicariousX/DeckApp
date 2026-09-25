import { useMemo, useRef, useState } from "react";
import {
  resolvedLinks,
  type ComboCard,
  type ComboLock,
} from "../lib/combos";
import styles from "./ComboAtlas.module.css";

type Props = {
  combos: ComboLock[];
  onSelect?: (card: ComboCard) => void;
};

export function ComboAtlas({ combos, onSelect }: Props) {
  const [cam, setCam] = useState({ x: 40, y: 20, s: 1 });
  const drag = useRef<{ x: number; y: number; cx: number; cy: number } | null>(
    null
  );

  const { nodes, edges } = useMemo(() => {
    const byId = new Map<string, ComboCard>();
    for (const combo of combos) {
      for (const col of combo.columns) {
        for (const c of col.cards) byId.set(c.oracle_id, c);
      }
    }
    const list = [...byId.values()];
    const pos = new Map<string, { x: number; y: number }>();
    const cx = 320;
    const cy = 220;
    const r = Math.min(180, 40 + list.length * 8);
    list.forEach((c, i) => {
      const a = (i / Math.max(1, list.length)) * Math.PI * 2 - Math.PI / 2;
      pos.set(c.oracle_id, {
        x: cx + Math.cos(a) * r,
        y: cy + Math.sin(a) * r,
      });
    });
    const seen = new Set<string>();
    const edges: { a: string; b: string }[] = [];
    for (const combo of combos) {
      for (const l of resolvedLinks(combo)) {
        const k = l.a < l.b ? `${l.a}|${l.b}` : `${l.b}|${l.a}`;
        if (seen.has(k)) continue;
        seen.add(k);
        if (pos.has(l.a) && pos.has(l.b)) edges.push(l);
      }
    }
    return {
      nodes: list.map((c) => ({ card: c, p: pos.get(c.oracle_id)! })),
      edges: edges.map((e) => ({
        ...e,
        a: pos.get(e.a)!,
        b: pos.get(e.b)!,
      })),
    };
  }, [combos]);

  return (
    <div className={styles.wrap}>
      <header className={styles.head}>
        <h2>Your Complete Map</h2>
        <p>Every stored link across your combos. Scroll to zoom, drag to pan.</p>
      </header>
      <svg
        className={styles.svg}
        viewBox="0 0 640 440"
        onWheel={(e) => {
          e.preventDefault();
          const next = e.deltaY > 0 ? cam.s * 0.92 : cam.s * 1.08;
          setCam((c) => ({ ...c, s: Math.min(2.4, Math.max(0.45, next)) }));
        }}
        onPointerDown={(e) => {
          (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
          drag.current = { x: e.clientX, y: e.clientY, cx: cam.x, cy: cam.y };
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          setCam({
            ...cam,
            x: drag.current.cx + (e.clientX - drag.current.x),
            y: drag.current.cy + (e.clientY - drag.current.y),
          });
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
      >
        <g transform={`translate(${cam.x} ${cam.y}) scale(${cam.s})`}>
          {edges.map((e, i) => (
            <line
              key={i}
              x1={e.a.x}
              y1={e.a.y}
              x2={e.b.x}
              y2={e.b.y}
              className={styles.edge}
            />
          ))}
          {nodes.map((n) => (
            <g
              key={n.card.oracle_id}
              className={styles.node}
              onClick={() => onSelect?.(n.card)}
            >
              {n.card.image ? (
                <image
                  href={n.card.image}
                  x={n.p.x - 14}
                  y={n.p.y - 20}
                  width="28"
                  height="40"
                  preserveAspectRatio="xMidYMid slice"
                />
              ) : (
                <circle cx={n.p.x} cy={n.p.y} r="7" />
              )}
              <text x={n.p.x + 16} y={n.p.y + 3}>
                {n.card.name.length > 18
                  ? `${n.card.name.slice(0, 17)}…`
                  : n.card.name}
              </text>
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}
