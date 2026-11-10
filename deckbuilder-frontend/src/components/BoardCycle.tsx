import type { DeckBoard } from "../types/deck";
import styles from "../pages/DeckBuilderPage.module.css";

type Board = { id: DeckBoard; label: string };

type Props = {
  boards: Board[];
  current: DeckBoard;
  open: boolean;
  onCycle: () => void;
  onSelect: (board: DeckBoard) => void;
  onToggleMenu: () => void;
};

export function BoardCycle({ boards, current, open, onCycle, onSelect, onToggleMenu }: Props) {
  const label = boards.find((b) => b.id === current)?.label ?? "Mainboard";
  return (
    <div className={styles.boardCycleWrap}>
      <button
        type="button"
        className={styles.addRowBtn}
        aria-label="Add to board. Click to cycle, right-click to choose."
        title="Click to cycle boards. Right-click to choose."
        onClick={onCycle}
        onContextMenu={(e) => {
          e.preventDefault();
          onToggleMenu();
        }}
      >
        {label}
      </button>
      {open && (
        <ul className={styles.boardCycleMenu} role="menu">
          {boards.map((b) => (
            <li key={b.id}>
              <button
                type="button"
                className={b.id === current ? `${styles.suggestItem} ${styles.groupBtnActive}` : styles.suggestItem}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onSelect(b.id)}
              >
                {b.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
