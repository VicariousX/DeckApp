import { useMemo, useState } from "react";
import { primaryTypeGroup } from "../lib/cards/cardTypes";
import {
  colorBalance,
  columnCount,
  copies,
  drawAtLeastOne,
  loadColumns,
  loadRecord,
  mainboard,
  manaCurve,
  matchColumn,
  saveColumns,
  saveRecord,
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
  { id: "text", label: "Name / notes" },
  { id: "tag", label: "Deck tag" },
  { id: "name", label: "Name contains" },
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
  const [drawCat, setDrawCat] = useState("type:Creature");
  const [drawN, setDrawN] = useState(7);

  function persistCols(next: StatColumn[]) {
    setCols(next);
    saveColumns(deckId, next);
  }
  function persistRec(next: RecordBook) {
    setRec(next);
    saveRecord(deckId, next);
  }

  const drawOptions = [
    ...types.map((t) => ({ id: `type:${t.label}`, label: `Type · ${t.label}`, count: t.count })),
    ...tags.map((t) => {
      const count = mainboard(cards)
        .filter((c) => (c.tag_ids ?? []).includes(t.id))
        .reduce((n, c) => n + (c.quantity || 1), 0);
      return { id: `tag:${t.id}`, label: `Tag · ${t.name}`, count };
    }),
    ...cols.map((c) => ({
      id: `col:${c.id}`,
      label: `Col · ${c.label || c.value}`,
      count: columnCount(cards, c, tags),
    })),
  ];

  const selectedDraw = drawOptions.find((o) => o.id === drawCat) ?? drawOptions[0];
  const pDraw = selectedDraw
    ? drawAtLeastOne(N, selectedDraw.count, Math.max(1, drawN))
    : 0;

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
          className={styles.boardSelect}
          value={selectedDraw?.id ?? ""}
          onChange={(e) => setDrawCat(e.target.value)}
        >
          {drawOptions.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label} ({o.count})
            </option>
          ))}
        </select>
        <label className={styles.hint}>
          Cards seen
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
        Chance of at least one: <strong>{(pDraw * 100).toFixed(1)}%</strong>
        {selectedDraw ? ` (${selectedDraw.count} of ${N})` : ""}
      </p>

      <h3 className={styles.sectionLabel}>Attribute columns</h3>
      <div className={styles.addRow}>
        <select
          className={styles.boardSelect}
          value={kind}
          onChange={(e) => setKind(e.target.value as StatKind)}
        >
          {KINDS.map((k) => (
            <option key={k.id} value={k.id}>
              {k.label}
            </option>
          ))}
        </select>
        {kind === "tag" ? (
          <select
            className={styles.boardSelect}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          >
            <option value="">Tag…</option>
            {tags.map((t) => (
              <option key={t.id} value={t.name}>
                {t.name}
              </option>
            ))}
          </select>
        ) : kind === "type" ? (
          <select
            className={styles.boardSelect}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          >
            <option value="">Type…</option>
            {["creature", "instant", "sorcery", "artifact", "enchantment", "planeswalker", "land", "battle"].map(
              (t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              )
            )}
          </select>
        ) : (
          <input
            className={styles.input}
            value={value}
            placeholder="Value"
            onChange={(e) => setValue(e.target.value)}
          />
        )}
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
            <strong>{columnCount(cards, c, tags)}</strong>
            <small>
              {mainboard(cards)
                .filter((card) => matchColumn(card, c, tags))
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
