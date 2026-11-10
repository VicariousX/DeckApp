import type { CardSortKey, DeckViewMode } from "../lib/deckPreferences";
import styles from "../pages/DeckBuilderPage.module.css";

type GroupMode = "type" | "tag" | "none" | "grid";

type Props = {
  groupMode: GroupMode;
  viewMode: DeckViewMode;
  cardSort: CardSortKey;
  cardFilter: string;
  onGroupMode: (mode: GroupMode) => void;
  onViewMode: (mode: DeckViewMode) => void;
  onSort: (sort: CardSortKey) => void;
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
  groupMode, viewMode, cardSort, cardFilter,
  onGroupMode, onViewMode, onSort, onFilter,
}: Props) {
  return (
    <div className={styles.toolbar}>
      <div className={styles.groupToggle} role="group" aria-label="Group by">
        {GROUP_OPTIONS.map(([mode, label]) => (
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
        className={styles.input}
        style={{ maxWidth: "12rem" }}
        placeholder="Filter…"
        value={cardFilter}
        onChange={(e) => onFilter(e.target.value)}
      />
      <select
        className={styles.addRowBtn}
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
