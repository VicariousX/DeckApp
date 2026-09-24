import { useEffect, useMemo, useState } from "react";
import { primaryTypeGroup } from "../lib/cards/cardTypes";
import { fetchCardsByNames } from "../lib/scryfallApi";
import {
  CARD_TYPES,
  SUPERTYPES,
  colorBalance,
  columnCount,
  copies,
  drawAtLeast,
  loadColumns,
  loadRecord,
  mainboard,
  manaCurve,
  matchColumn,
  saveColumns,
  saveRecord,
  subtypesOf,
  typeCounts,
  type RecordBook,
  type StatColumn,
  type StatKind,
} from "../lib/deck/deckAnalytics";
import type { DeckCard, DeckTag } from "../types/deck";
import styles from "../pages/DeckBuilderPage.module.css";

type Props = {
  deckId: string;
  cards: DeckCard[];
  tags: DeckTag[];
  totalCards: number;
  boardCounts: Record<string, number>;
};

const KINDS: { id: StatKind; label: string }[] = [
  { id: "type", label: "Type" },
  { id: "subtype", label: "Subtype" },
  { id: "supertype", label: "Supertype" },
  { id: "tag", label: "Deck tag" },
  { id: "oracle", label: "Oracle text" },
];

export function DeckStatsPanel({
  deckId,
  cards,
  tags,
  totalCards,
  boardCounts,
}: Props) {
  const curve = useMemo(() => manaCurve(cards), [cards]);
  const colors = useMemo(() => colorBalance(cards), [cards]);
  const types = useMemo(() => typeCounts(cards), [cards]);
  const N = copies(mainboard(cards));
  const curveMax = Math.max(1, ...curve.map((b) => b.count));
  const colorMax = Math.max(1, ...colors.map((b) => b.count));
  const typeMax = Math.max(1, ...types.map((b) => b.count));

  const [cols, setCols] = useState<StatColumn[]>(() => loadColumns(deckId));
  const [rec, setRec] = useState<RecordBook>(() => loadRecord(deckId));
  const [kind, setKind] = useState<StatKind>("type");
  const [value, setValue] = useState("");
  const [drawKind, setDrawKind] = useState<StatKind>("type");
  const [drawValue, setDrawValue] = useState("Creature");
  const [drawNeed, setDrawNeed] = useState(1);
  const [drawN, setDrawN] = useState(7);
  const [oracleByName, setOracleByName] = useState<Record<string, string>>({});

  useEffect(() => {
    const names = [...new Set(cards.map((c) => c.name))];
    if (!names.length) return;
    let cancelled = false;
    void fetchCardsByNames(names).then(({ byName }) => {
      if (cancelled) return;
      const map: Record<string, string> = {};
      for (const [k, card] of byName) {
        map[k] = [card.oracle_text ?? "", ...(card.card_faces ?? []).map((f) => f.oracle_text ?? "")].join(" ");
      }
      setOracleByName(map);
    });
    return () => {
      cancelled = true;
    };
  }, [cards]);

  const subtypeOpts = useMemo(() => {
    const set = new Set<string>();
    for (const c of cards) for (const s of subtypesOf(c.type_line || "")) set.add(s);
    return [...set].sort();
  }, [cards]);

  function suggestionsFor(k: StatKind): string[] {
    if (k === "type") return [...CARD_TYPES];
    if (k === "subtype") return subtypeOpts;
    if (k === "supertype") return [...SUPERTYPES];
    if (k === "tag") return tags.map((t) => t.name);
    return [];
  }

  function persistCols(next: StatColumn[]) {
    setCols(next);
    saveColumns(deckId, next);
  }
  function persistRec(next: RecordBook) {
    setRec(next);
    saveRecord(deckId, next);
  }

  const drawCol: StatColumn = {
    id: "draw",
    label: drawValue,
    kind: drawKind,
    value: drawValue,
  };
  const drawK = columnCount(cards, drawCol, tags, oracleByName);
  const pDraw = drawAtLeast(N, drawK, Math.max(1, drawN), Math.max(1, drawNeed));

  return (
    <section className={styles.placeholderPanel}>
      <h2 className={styles.sectionLabel}>Deck stats</h2>
      <ul className={styles.statsList}>
        <li>
          <strong>Total</strong>: {totalCards} cards ({cards.length} unique)
        </li>
        {Object.entries(boardCounts).map(([id, n]) => (
          <li key={id}>
            <strong>{id}</strong>: {n}
          </li>
        ))}
      </ul>

      <h3 className={styles.sectionLabel}>Mana curve</h3>
      <div className={styles.chart}>
        {curve.map((b) => (
          <div key={b.bucket} className={styles.chartCol}>
            <div
              className={styles.chartBar}
              style={{ height: `${(b.count / curveMax) * 100}%` }}
              title={`${b.bucket}: ${b.count}`}
            />
            <span>{b.bucket}</span>
            <small>{b.count}</small>
          </div>
        ))}
      </div>

      <h3 className={styles.sectionLabel}>Color balance</h3>
      <div className={styles.chart}>
        {colors.map((b) => (
          <div key={b.color} className={styles.chartCol}>
            <div
              className={`${styles.chartBar} ${styles[`pip${b.color}`] ?? ""}`}
              style={{ height: `${(b.count / colorMax) * 100}%` }}
            />
            <span>{b.color}</span>
            <small>{b.count}</small>
          </div>
        ))}
      </div>

      <h3 className={styles.sectionLabel}>Types</h3>
      <div className={styles.chartH}>
        {types.map((t) => (
          <div key={t.label} className={styles.chartHRow}>
            <span>{t.label}</span>
            <div className={styles.chartHTrack}>
              <div
                className={styles.chartHFill}
                style={{ width: `${(t.count / typeMax) * 100}%` }}
              />
            </div>
            <small>{t.count}</small>
          </div>
        ))}
      </div>

      <h3 className={styles.sectionLabel}>Draw odds</h3>
      <div className={styles.addRow}>
        <select
          className={styles.addRowBtn}
          value={drawKind}
          onChange={(e) => setDrawKind(e.target.value as StatKind)}
        >
          {KINDS.map((k) => (
            <option key={k.id} value={k.id}>
              {k.label}
            </option>
          ))}
        </select>
        <input
          className={styles.input}
          list="draw-suggest"
          value={drawValue}
          placeholder="Value"
          onChange={(e) => setDrawValue(e.target.value)}
        />
        <datalist id="draw-suggest">
          {suggestionsFor(drawKind).map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
        <label className={styles.hint}>
          At least
          <input
            className={styles.qtyInput}
            type="number"
            min={1}
            value={drawNeed}
            onChange={(e) => setDrawNeed(Math.max(1, Number(e.target.value) || 1))}
          />
        </label>
        <label className={styles.hint}>
          Seen
          <input
            className={styles.qtyInput}
            type="number"
            min={1}
            max={N || 1}
            value={drawN}
            onChange={(e) => setDrawN(Number(e.target.value) || 7)}
          />
        </label>
      </div>
      <p>
        Chance of at least {drawNeed} in {drawN}:{" "}
        <strong>{(pDraw * 100).toFixed(1)}%</strong>
        {` (${drawK} of ${N})`}
      </p>

      <h3 className={styles.sectionLabel}>Attribute columns</h3>
      <div className={styles.addRow}>
        <select
          className={styles.addRowBtn}
          value={kind}
          onChange={(e) => setKind(e.target.value as StatKind)}
        >
          {KINDS.map((k) => (
            <option key={k.id} value={k.id}>
              {k.label}
            </option>
          ))}
        </select>
        <input
          className={styles.input}
          list="col-suggest"
          value={value}
          placeholder="Value"
          onChange={(e) => setValue(e.target.value)}
        />
        <datalist id="col-suggest">
          {suggestionsFor(kind).map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
        <button
          type="button"
          className={styles.ghostBtn}
          onClick={() => {
            if (!value.trim()) return;
            persistCols([
              ...cols,
              {
                id: `col-${Date.now()}`,
                label: `${kind}: ${value.trim()}`,
                kind,
                value: value.trim(),
              },
            ]);
            setValue("");
          }}
        >
          Add column
        </button>
      </div>
      <div className={styles.statTable}>
        {cols.map((c) => (
          <div key={c.id} className={styles.statCell}>
            <header>
              {c.label}
              <button
                type="button"
                onClick={() => persistCols(cols.filter((x) => x.id !== c.id))}
              >
                ×
              </button>
            </header>
            <strong>{columnCount(cards, c, tags, oracleByName)}</strong>
            <small>
              {mainboard(cards)
                .filter((card) => matchColumn(card, c, tags, oracleByName))
                .slice(0, 4)
                .map((card) => card.name)
                .join(", ") || "—"}
            </small>
          </div>
        ))}
        {cols.length === 0 && <p className={styles.hint}>Add a column to count a slice of the deck.</p>}
      </div>

      <h3 className={styles.sectionLabel}>Record</h3>
      <div className={styles.addRow}>
        {(["wins", "losses", "draws"] as const).map((k) => (
          <label key={k} className={styles.hint}>
            {k}
            <span className={styles.qtyBtns}>
              <button
                type="button"
                onClick={() => persistRec({ ...rec, [k]: Math.max(0, rec[k] - 1) })}
              >
                −
              </button>
              <strong>{rec[k]}</strong>
              <button type="button" onClick={() => persistRec({ ...rec, [k]: rec[k] + 1 })}>
                +
              </button>
            </span>
          </label>
        ))}
        <span className={styles.hint}>
          {rec.wins + rec.losses + rec.draws > 0
            ? `${((rec.wins / (rec.wins + rec.losses + rec.draws)) * 100).toFixed(0)}% wins`
            : "No games yet"}
        </span>
      </div>
      <p className={styles.hint}>
        Type mix uses {primaryTypeGroup("Creature")} grouping. Record is stored on this device.
      </p>
    </section>
  );
}
