import { ManaCost } from "./ManaCost";
import type { DeckCard, DeckBoard } from "../types/deck";
import styles from "../pages/DeckBuilderPage.module.css";

type DisplaySection = {
  id: DeckBoard;
  label: string;
  count: number;
  cards: DeckCard[];
  groups: { key: string; label: string; cards: DeckCard[] }[];
};

type Props = {
  displaySections: DisplaySection[];
  addTargetBoard: DeckBoard;
  isOwner: boolean;
  issuesByOracle: Map<string, unknown[]>;
  onToggleOracle: (c: DeckCard) => void;
  onCardContext: (e: { preventDefault: () => void; clientX: number; clientY: number }, c: DeckCard) => void;
  onQty: (c: DeckCard, d: number) => void;
  onMore: (c: DeckCard, x: number, y: number) => void;
};

export function DeckTextView({
  displaySections, addTargetBoard, isOwner, issuesByOracle,
  onToggleOracle, onCardContext, onQty, onMore,
}: Props) {
  const visible = displaySections.filter((board) => {
    if (board.cards.length > 0) return true;
    if (board.id === "commander" || board.id === "main") return true;
    return board.id === addTargetBoard;
  });

  return (
    <div className={styles.boardZones}>
      {visible.map((board) => (
        <section key={board.id} className={styles.boardZone} data-board={board.id}>
          <header className={styles.boardZoneHeader}>
            <h2 className={styles.boardZoneTitle}>{board.label}</h2>
            <span className={styles.boardZoneCount}>{board.count}</span>
          </header>
          {board.cards.length === 0 ? (
            <p className={styles.boardZoneEmpty}>
              {board.id === "commander"
                ? "Choose a commander with the field above."
                : board.id === "main"
                  ? "Add cards using the field above."
                  : "Add cards to this board."}
            </p>
          ) : (
            <div className={styles.groups}>
              {board.groups.map((g) => {
                const count = g.cards.reduce((n, c) => n + c.quantity, 0);
                return (
                  <div key={`${board.id}-${g.key}`} className={styles.group}>
                    <h3 className={styles.groupTitle}>
                      {g.label}
                      <span className={styles.groupCount}>{count}</span>
                    </h3>
                    <ul className={styles.cardList}>
                      {g.cards.map((c) => (
                        <li key={c.id} className={`${styles.cardRow}${issuesByOracle.has(c.oracle_id.toLowerCase()) ? ` ${styles.cardRowIllegal}` : ""}`}>
                          <div className={styles.cardMain}>
                            <div className={styles.cardPrimary}>
                              {isOwner && (
                                <span className={styles.qtyControl}>
                                  <button type="button" className={styles.qtyBtn} aria-label={`Decrease ${c.name}`} onClick={() => void onQty(c, -1)}>−</button>
                                  <span className={styles.qty}>{c.quantity}</span>
                                  <button type="button" className={styles.qtyBtn} aria-label={`Increase ${c.name}`} onClick={() => void onQty(c, 1)}>+</button>
                                </span>
                              )}
                              <button
                                type="button"
                                className={styles.cardName}
                                onClick={() => void onToggleOracle(c)}
                                onContextMenu={(e) => onCardContext(e, c)}
                              >
                                {c.name}
                              </button>
                              <ManaCost cost={c.mana_cost} size={14} />
                              <button
                                type="button"
                                className={styles.moreBtn}
                                aria-label={`Options for ${c.name}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const r = e.currentTarget.getBoundingClientRect();
                                  onMore(c, r.left, r.bottom);
                                }}
                              >
                                ⋮
                              </button>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
