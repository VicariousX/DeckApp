import { QtyControl } from "./QtyControl";
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
  isMobile: boolean;
  isOwner: boolean;
  issuesByOracle: Map<string, unknown[]>;
  totalCards: number;
  onToggleOracle: (c: DeckCard) => void;
  onCardContext: (e: { preventDefault: () => void; clientX: number; clientY: number }, c: DeckCard) => void;
  onQty: (c: DeckCard, d: number) => void;
  onQtyCommit: (c: DeckCard, raw: string) => void;
  onRemove: (c: DeckCard) => void;
  onMore: (c: DeckCard, x: number, y: number) => void;
};

export function DeckTextView({
  displaySections, isMobile, isOwner, issuesByOracle, totalCards,
  onToggleOracle, onCardContext, onQty, onQtyCommit, onRemove, onMore,
}: Props) {
  return (
    <div className={styles.boardZones}>
      {displaySections.map((board) => (
        <section key={board.id} className={styles.boardZone} data-board={board.id}>
          <header className={styles.boardZoneHeader}>
            <h2 className={styles.boardZoneTitle}>{board.label}</h2>
            <span className={styles.boardZoneCount}>{board.count}</span>
          </header>
          {board.cards.length === 0 ? (
            <p className={styles.boardZoneEmpty}>No cards on this board.</p>
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
                              {!isMobile && (
                                <QtyControl
                                  quantity={c.quantity}
                                  disabled={!isOwner}
                                  onDelta={(d) => void onQty(c, d)}
                                  onCommit={(raw) => void onQtyCommit(c, raw)}
                                />
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
                              {isMobile && (
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
                              )}
                            </div>
                            {isOwner && !isMobile && (
                              <button
                                type="button"
                                className={styles.removeBtn}
                                onClick={() => void onRemove(c)}
                              >
                                Remove
                              </button>
                            )}
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
      {totalCards === 0 && (
        <p className={styles.empty}>No cards yet. Use the search above to add some.</p>
      )}
    </div>
  );
}
