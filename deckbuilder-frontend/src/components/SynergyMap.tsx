import { useMemo, useState } from "react";
import { useIsMobile } from "../hooks/useIsMobile";
import {
  SYNERGY_TAGS,
  buildSynergyGraph,
  tagCounts,
  type CommunityMark,
  type SynergyCard,
  type TaggedCard,
} from "../lib/synergy/engine";
import styles from "./SynergyMap.module.css";

type Props = {
  cards: SynergyCard[];
  community?: CommunityMark[];
  extraEdges?: { a: string; b: string; label?: string }[];
  onSelect?: (key: string) => void;
};

function labelFor(id: string) {
  return SYNERGY_TAGS.find((t) => t.id === id)?.label ?? id;
}

export function SynergyMap({ cards, community = [], extraEdges = [], onSelect }: Props) {
  const mobile = useIsMobile(900);
  const { nodes } = useMemo(
    () => buildSynergyGraph(cards, 1, community),
    [cards, community]
  );
  const counts = useMemo(
    () => [...tagCounts(nodes)].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
    [nodes]
  );
  const byKey = useMemo(() => new Map(nodes.map((n) => [n.key, n])), [nodes]);
  const columns = useMemo(() => {
    const fromTags = counts.map((t) => ({
      id: t.id as string,
      label: t.label,
      cards: nodes
        .filter((n) => n.tags.includes(t.id))
        .sort((a, b) => a.name.localeCompare(b.name)),
    }));
    const grouped = new Map<string, string[]>();
    for (const mark of community) {
      const list = grouped.get(mark.mechanic) ?? [];
      if (!list.includes(mark.key)) list.push(mark.key);
      grouped.set(mark.mechanic, list);
    }
    const fromCommunity = [...grouped.entries()]
      .filter(([id, keys]) => keys.length >= 2 && !fromTags.some((c) => c.id === id))
      .map(([id, keys]) => ({
        id,
        label: labelFor(id),
        cards: keys
          .map((key) => byKey.get(key))
          .filter((card): card is TaggedCard => Boolean(card))
          .sort((a, b) => a.name.localeCompare(b.name)),
      }));
    return [...fromTags, ...fromCommunity].sort(
      (a, b) => b.cards.length - a.cards.length || a.label.localeCompare(b.label)
    );
  }, [counts, nodes, community, byKey]);
  const [filter, setFilter] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const engines = columns.filter((t) => t.cards.length >= 2);
  const active = filter ?? (mobile && engines[0] ? engines[0].id : "all");
  const shown = active === "all" ? engines : columns.filter((t) => t.id === active);
  const picked = selected ? byKey.get(selected) : undefined;

  function choose(key: string) {
    setSelected((cur) => (cur === key ? null : key));
    onSelect?.(key);
  }

  function role(key: string) {
    const marks = community.filter((m) => m.key === key);
    if (!marks.length) return null;
    if (marks.some((m) => m.economy === "both")) return "both";
    return marks[0].economy;
  }

  const links = extraEdges
    .map((e) => ({ ...e, an: byKey.get(e.a)?.name, bn: byKey.get(e.b)?.name }))
    .filter((e) => e.an && e.bn);

  return (
    <div className={styles.wrap}>
      {columns.length === 0 && links.length === 0 ? (
        <p className={styles.empty}>
          No engines yet. Shared mechanics show up once card text is loaded.
        </p>
      ) : (
        <>
          {columns.length > 0 && (
          <div className={styles.filters} role="tablist" aria-label="Engines">
            <button
              type="button"
              className={active === "all" ? styles.chipOn : styles.chip}
              onClick={() => setFilter("all")}
            >
              All
            </button>
            {columns.map((t) => (
              <button
                key={t.id}
                type="button"
                className={active === t.id ? styles.chipOn : styles.chip}
                onClick={() => setFilter(t.id)}
              >
                {t.label}
                <span>{t.cards.length}</span>
              </button>
            ))}
          </div>
          )}

          {picked && (
            <div className={styles.focus}>
              <strong>{picked.name}</strong>
              <div className={styles.focusTags}>
                {picked.tags.map((t) => (
                  <button key={t} type="button" className={styles.chip} onClick={() => setFilter(t)}>
                    {labelFor(t)}
                  </button>
                ))}
                {picked.tags.length === 0 && <span className={styles.muted}>No tagged mechanic</span>}
              </div>
              <button type="button" className={styles.clear} onClick={() => setSelected(null)}>
                Clear
              </button>
            </div>
          )}

          {links.length > 0 && (
            <div className={styles.links}>
              {links.map((e, i) => (
                <button key={`${e.a}-${e.b}-${i}`} type="button" className={styles.link} onClick={() => choose(e.a)}>
                  {e.an} <span>↔</span> {e.bn}
                  {e.label ? <em>{e.label}</em> : null}
                </button>
              ))}
            </div>
          )}

          {shown.length === 0 ? (
            <p className={styles.empty}>Nothing shares a mechanic yet.</p>
          ) : (
            <div className={styles.columns}>
              {shown.map((engine) => {
                const holdsPick = picked ? engine.cards.some((c) => c.key === picked.key) : false;
                return (
                  <section
                    key={engine.id}
                    className={`${styles.column}${picked && !holdsPick ? ` ${styles.columnDim}` : ""}${holdsPick ? ` ${styles.columnOn}` : ""}`}
                  >
                    <header>
                      <h3>{engine.label}</h3>
                      <span>{engine.cards.length}</span>
                    </header>
                    <ul>
                      {engine.cards.map((card) => {
                        const on = card.key === selected;
                        const kin =
                          picked &&
                          !on &&
                          card.tags.some((t) => t !== engine.id && picked.tags.includes(t));
                        const mark = role(card.key);
                        return (
                          <li key={card.key}>
                            <button
                              type="button"
                              className={`${styles.card}${on ? ` ${styles.cardOn}` : ""}${kin ? ` ${styles.cardKin}` : ""}`}
                              onClick={() => choose(card.key)}
                            >
                              <span>{card.name}</span>
                              {mark && <em>{mark}</em>}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
