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

export function DeckToolbar({
  groupMode, viewMode, cardSort, sortDir, cardFilter,
  onGroupMode, onViewMode, onSort, onSortDir, onFilter,
}: Props) {
  const groupOptions = GROUP_OPTIONS.filter(([mode]) => viewMode === "image" || mode !== "grid");
  return (
    <div className={styles.toolbar}>
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
      <input
        className={`${styles.input} ${styles.toolbarFilter}`}
        placeholder="Filter…"
        value={cardFilter}
        onChange={(e) => onFilter(e.target.value)}
      />
      <select
        className={`${styles.addRowBtn} ${styles.toolbarDesk}`}
        value={cardSort}
        aria-label="Sort"
        onChange={(e) => onSort(e.target.value as CardSortKey)}
      >
        <option value="default">Sort: default</option>
        <option value="name">Sort: name</option>
        <option value="cmc">Sort: mana value</option>
        <option value="type">Sort: type</option>
        <option value="qty">Sort: quantity</option>
      </select>
      <button
        type="button"
        className={`${styles.groupBtn} ${styles.groupBtnActive} ${styles.toolbarDesk}`}
        aria-label={sortDir === "asc" ? "Ascending. Click for descending." : "Descending. Click for ascending."}
        onClick={() => onSortDir(sortDir === "asc" ? "desc" : "asc")}
      >
        {sortDir === "asc" ? "Asc" : "Desc"}
      </button>
      <div className={styles.groupToggle} role="group" aria-label="Deck view">
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
