import { useMemo, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { useIsMobile } from "../hooks/useIsMobile";
import {
  SYNERGY_TAGS,
  buildSynergyGraph,
  tagCounts,
  type CommunityMark,
  type SynergyCard,
  type TaggedCard,
} from "../lib/synergy/engine";
import { submitVerdict } from "../services/mechanicMarkService";
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
  const { user } = useAuth();
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
  const [verdicts, setVerdicts] = useState<Record<string, "validate" | "nullify">>({});
  const [verdictBusy, setVerdictBusy] = useState<string | null>(null);
  const [verdictNote, setVerdictNote] = useState<string | null>(null);

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
    if (marks.some((m) => m.relation === "both")) return "Both";
    if (marks[0].relation === "cause") return "Cause";
    return "Benefit";
  }

  function dropped(cardKey: string, engineId: string) {
    return verdicts[`${cardKey}:${engineId}`] === "nullify";
  }

  async function onVerdict(tag: string, verdict: "validate" | "nullify") {
    if (!picked) return;
    if (!user) {
      setVerdictNote("Log in to train the map.");
      return;
    }
    setVerdictBusy(`${picked.key}:${tag}`);
    setVerdictNote(null);
    const { error } = await submitVerdict(user.id, picked.key, tag, verdict);
    setVerdictBusy(null);
    if (error) {
      setVerdictNote(error);
      return;
    }
    setVerdicts((prev) => ({ ...prev, [`${picked.key}:${tag}`]: verdict }));
    setVerdictNote(verdict === "validate" ? "Validated." : "Nullified.");
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
            <div className={styles.viewer}>
              {picked.image ? (
                <img src={picked.image} alt="" className={styles.viewerImg} />
              ) : (
                <div className={styles.viewerPh}>{picked.name.slice(0, 1)}</div>
              )}
              <div className={styles.viewerBody}>
                <div className={styles.viewerHead}>
                  <strong>{picked.name}</strong>
                  <button type="button" className={styles.clear} onClick={() => setSelected(null)}>
                    Close
                  </button>
                </div>
                {picked.oracle ? (
                  <p className={styles.oracle}>{picked.oracle}</p>
                ) : (
                  <p className={styles.muted}>Oracle text is still loading.</p>
                )}
                <ul className={styles.verdicts}>
                  {(picked.tags.length ? picked.tags : []).map((tag) => {
                    const key = `${picked.key}:${tag}`;
                    const state = verdicts[key];
                    return (
                      <li key={tag}>
                        <span>{labelFor(tag)}</span>
                        <button
                          type="button"
                          className={state === "validate" ? styles.verdictOn : styles.verdict}
                          disabled={verdictBusy === key}
                          onClick={() => void onVerdict(tag, "validate")}
                        >
                          Validate
                        </button>
                        <button
                          type="button"
                          className={state === "nullify" ? styles.verdictOff : styles.verdict}
                          disabled={verdictBusy === key}
                          onClick={() => void onVerdict(tag, "nullify")}
                        >
                          Nullify
                        </button>
                      </li>
                    );
                  })}
                  {picked.tags.length === 0 && <li className={styles.muted}>No plotted mechanic on this card.</li>}
                </ul>
                {verdictNote && <p className={styles.muted}>{verdictNote}</p>}
              </div>
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
                const visible = engine.cards.filter((card) => !dropped(card.key, engine.id));
                const holdsPick = picked ? visible.some((c) => c.key === picked.key) : false;
                return (
                  <section
                    key={engine.id}
                    className={`${styles.column}${picked && !holdsPick ? ` ${styles.columnDim}` : ""}${holdsPick ? ` ${styles.columnOn}` : ""}`}
                  >
                    <header>
                      <h3>{engine.label}</h3>
                      <span>{visible.length}</span>
                    </header>
                    <ul>
                      {visible.map((card) => {
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
