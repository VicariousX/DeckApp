import type { RefObject } from "react";
import { BoardCycle } from "./BoardCycle";
import { DeckSearchToggle } from "./search/DeckSearchDock";
import type { DeckBoard } from "../types/deck";
import type { PanelTab } from "./PanelTabs";
import styles from "../pages/DeckBuilderPage.module.css";

type Board = { id: DeckBoard; label: string };

type Props = {
  panel: PanelTab;
  query: string;
  suggestions: string[];
  suggestOpen: boolean;
  addBusy: boolean;
  tokenBusy: boolean;
  boards: Board[];
  addTargetBoard: DeckBoard;
  boardMenuOpen: boolean;
  searchOpen: boolean;
  wrapRef: RefObject<HTMLDivElement | null>;
  onQuery: (q: string) => void;
  onAdd: (name: string) => void;
  onCycleBoard: () => void;
  onSelectBoard: (b: DeckBoard) => void;
  onToggleBoardMenu: () => void;
  onToggleSearch: () => void;
  onRefreshTokens: () => void;
};

export function AddCardRow({
  panel, query, suggestions, suggestOpen, addBusy, tokenBusy,
  boards, addTargetBoard, boardMenuOpen, searchOpen, wrapRef,
  onQuery, onAdd, onCycleBoard, onSelectBoard, onToggleBoardMenu,
  onToggleSearch, onRefreshTokens,
}: Props) {
  return (
    <div className={styles.addRow} ref={wrapRef}>
      <div className={styles.inputWrap}>
        <input
          className={styles.input}
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onAdd(query.trim());
            }
          }}
          placeholder={panel === "tokens" ? "Token name…" : "Card name…"}
          autoComplete="off"
        />
        {suggestOpen && suggestions.length > 0 && (
          <ul className={styles.suggestList}>
            {suggestions.map((n) => (
              <li key={n}>
                <button
                  type="button"
                  className={styles.suggestItem}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => onAdd(n)}
                >
                  {n}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {panel === "deck" && (
        <BoardCycle
          boards={boards}
          current={addTargetBoard}
          open={boardMenuOpen}
          onCycle={onCycleBoard}
          onSelect={onSelectBoard}
          onToggleMenu={onToggleBoardMenu}
        />
      )}
      {panel === "deck" && (
        <DeckSearchToggle open={searchOpen} onToggle={onToggleSearch} />
      )}
      {panel === "tokens" && (
        <button
          type="button"
          className={styles.addRowBtn}
          disabled={tokenBusy}
          onClick={onRefreshTokens}
        >
          {tokenBusy ? "Refreshing…" : "Refresh"}
        </button>
      )}
      <button
        type="button"
        className={styles.primaryBtn}
        disabled={addBusy || !query.trim()}
        onClick={() => onAdd(query.trim())}
      >
        {addBusy ? "Adding…" : "Add"}
      </button>
    </div>
  );
}
