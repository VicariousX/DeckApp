import { useEffect, useRef, useState, type ReactNode } from "react";
import type { CardSortKey, DeckViewMode, SortDir } from "../lib/deckPreferences";
import styles from "../pages/DeckBuilderPage.module.css";

type GroupMode = "type" | "tag" | "none" | "grid";

type Props = {
  groupMode: GroupMode;
  viewMode: DeckViewMode;
  cardSort: CardSortKey;
  sortDir: SortDir;
  cardFilter: string;
  onGroupMode: (mode: GroupMode) => void;
  onViewMode: (mode: DeckViewMode) => void;
  onSort: (sort: CardSortKey) => void;
  onSortDir: (dir: SortDir) => void;
  onFilter: (filter: string) => void;
  tools?: ReactNode;
};

const GROUP_OPTIONS: [GroupMode, string][] = [
  ["type", "Type"],
  ["tag", "Tags"],
  ["none", "List"],
  ["grid", "Grid"],
];

const VIEW_OPTIONS: [DeckViewMode, string][] = [
  ["text", "Text"],
  ["image", "Images"],
];

const SORTS: [CardSortKey, string][] = [
  ["default", "Default"],
  ["name", "Name"],
  ["cmc", "Mana value"],
  ["type", "Type"],
  ["qty", "Quantity"],
];

export function DeckToolbar({
  groupMode, viewMode, cardSort, sortDir, cardFilter,
  onGroupMode, onViewMode, onSort, onSortDir, onFilter, tools,
}: Props) {
  const groupOptions = GROUP_OPTIONS.filter(([mode]) => viewMode === "image" || mode !== "grid");
  const sortLabel = SORTS.find(([id]) => id === cardSort)?.[1] ?? "Default";
  const [sortOpen, setSortOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sortOpen) return;
    function onPointer(event: PointerEvent) {
      if (!sortRef.current?.contains(event.target as Node)) setSortOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setSortOpen(false);
    }
    window.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [sortOpen]);

  return (
    <div className={styles.toolbar}>
      <input
        className={`${styles.input} ${styles.toolbarFilter}`}
        placeholder="Filter by: name, type, oracle, MV<=3, c:wu, id:bug"
        value={cardFilter}
        onChange={(e) => onFilter(e.target.value)}
      />
      <span className={styles.barRule} aria-hidden="true" />
      <div className={`${styles.sortPair} ${styles.toolbarDesk}`} ref={sortRef}>
        <button
          type="button"
          className={styles.sortPick}
          aria-haspopup="listbox"
          aria-expanded={sortOpen}
          onClick={() => setSortOpen((v) => !v)}
        >
          <span>Sort: {sortLabel}</span>
          <svg viewBox="0 0 12 12" aria-hidden="true">
            <path d="M2.5 4.5 6 8l3.5-3.5" />
          </svg>
        </button>
        <button
          type="button"
          className={styles.sortDir}
          aria-label={sortDir === "asc" ? "Ascending. Click for descending." : "Descending. Click for ascending."}
          onClick={() => onSortDir(sortDir === "asc" ? "desc" : "asc")}
        >
          <svg viewBox="0 0 12 12" aria-hidden="true">
            {sortDir === "asc" ? <path d="M6 2.2 10 9H2z" /> : <path d="M6 9.8 2 3h8z" />}
          </svg>
        </button>
        {sortOpen && (
          <ul className={styles.sortMenu} role="listbox" aria-label="Sort">
            {SORTS.map(([id, label]) => (
              <li key={id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={cardSort === id}
                  className={cardSort === id ? styles.sortOptionOn : styles.sortOption}
                  onClick={() => {
                    onSort(id);
                    setSortOpen(false);
                  }}
                >
                  {label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {tools ? <span className={styles.barRule} aria-hidden="true" /> : null}
      {tools}
      <span className={styles.barRule} aria-hidden="true" />
      <div className={`${styles.groupToggle} ${styles.toolbarDesk}`} role="group" aria-label="Group by">
        {groupOptions.map(([mode, label]) => (
          <button
            key={mode}
            type="button"
            className={groupMode === mode ? `${styles.groupBtn} ${styles.groupBtnActive}` : styles.groupBtn}
            onClick={() => onGroupMode(mode)}
          >
            {label}
          </button>
        ))}
      </div>
      <span className={styles.barRule} aria-hidden="true" />
      <div className={`${styles.groupToggle} ${styles.toolbarView}`} role="group" aria-label="Deck view">
        {VIEW_OPTIONS.map(([mode, label]) => (
          <button
            key={mode}
            type="button"
            className={viewMode === mode ? `${styles.groupBtn} ${styles.groupBtnActive}` : styles.groupBtn}
            onClick={() => onViewMode(mode)}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
