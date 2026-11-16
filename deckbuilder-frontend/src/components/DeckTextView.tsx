import { useEffect, useRef, useState, type TouchEvent } from "react";
import { ManaCost } from "./ManaCost";
import { renderTextWithSymbols } from "../utils/symbols";
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
  expandedId: string | null;
  oracleById: Record<string, string>;
  imageFor: (c: DeckCard) => string | undefined;
  onToggleOracle: (c: DeckCard) => void;
  onCardContext: (e: { preventDefault: () => void; clientX: number; clientY: number }, c: DeckCard) => void;
  onQty: (c: DeckCard, d: number) => void;
  onMore: (c: DeckCard, x: number, y: number) => void;
};

function isBasicLand(c: DeckCard) {
  const type = c.type_line.toLowerCase();
  return type.includes("basic") && type.includes("land");
}

export function DeckTextView({
  displaySections, addTargetBoard, isOwner, issuesByOracle,
  expandedId, oracleById, imageFor,
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
                        <TextRow
                          key={c.id}
                          card={c}
                          illegal={issuesByOracle.has(c.oracle_id.toLowerCase())}
                          open={expandedId === c.id}
                          oracle={oracleById[c.id]}
                          image={imageFor(c)}
                          isOwner={isOwner}
                          onToggle={() => void onToggleOracle(c)}
                          onContext={(e) => onCardContext(e, c)}
                          onQty={(d) => void onQty(c, d)}
                          onMore={(x, y) => onMore(c, x, y)}
                        />
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

function TextRow({
  card, illegal, open, oracle, image, isOwner, onToggle, onContext, onQty, onMore,
}: {
  card: DeckCard;
  illegal: boolean;
  open: boolean;
  oracle: string | undefined;
  image: string | undefined;
  isOwner: boolean;
  onToggle: () => void;
  onContext: (e: { preventDefault: () => void; clientX: number; clientY: number }) => void;
  onQty: (d: number) => void;
  onMore: (x: number, y: number) => void;
}) {
  const [face, setFace] = useState<"card" | "oracle">("card");
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const basic = isBasicLand(card);

  useEffect(() => {
    if (!open) setFace("card");
  }, [open]);

  function onTouchStart(e: TouchEvent) {
    if ((e.target as HTMLElement).closest("button")) return;
    const t = e.changedTouches[0];
    swipe.current = { x: t.clientX, y: t.clientY };
  }

  function onTouchEnd(e: TouchEvent) {
    const start = swipe.current;
    swipe.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) > 42 && Math.abs(dx) > Math.abs(dy)) {
      setFace((f) => (f === "card" ? "oracle" : "card"));
    }
  }

  return (
    <li className={`${styles.cardRow}${illegal ? ` ${styles.cardRowIllegal}` : ""}${open ? ` ${styles.cardRowOpen}` : ""}`}>
      <div className={styles.cardMain}>
        <div className={styles.cardPrimary}>
          <button
            type="button"
            className={styles.cardThumb}
            aria-expanded={open}
            aria-label={open ? `Hide ${card.name}` : `Show ${card.name}`}
            onClick={onToggle}
            onContextMenu={onContext}
          >
            {image ? <img src={image} alt="" /> : <span className={styles.cardThumbEmpty} />}
          </button>
          <button
            type="button"
            className={styles.cardName}
            aria-expanded={open}
            onClick={onToggle}
            onContextMenu={onContext}
          >
            {card.name}
          </button>
          <ManaCost cost={card.mana_cost} size={14} />
          {isOwner && basic ? (
            <span className={styles.qtyCompact}>
              <button type="button" className={styles.qtyBtn} aria-label={`Decrease ${card.name}`} onClick={() => onQty(-1)}>−</button>
              <span className={styles.qty}>{card.quantity}</span>
              <button type="button" className={styles.qtyBtn} aria-label={`Increase ${card.name}`} onClick={() => onQty(1)}>+</button>
            </span>
          ) : card.quantity > 1 ? (
            <span className={styles.qtyMark}>×{card.quantity}</span>
          ) : null}
          <button
            type="button"
            className={styles.moreBtn}
            aria-label={`Options for ${card.name}`}
            onClick={(e) => {
              e.stopPropagation();
              const r = e.currentTarget.getBoundingClientRect();
              onMore(r.left, r.bottom);
            }}
          >
            ⋮
          </button>
        </div>
        {open && (
          <div
            className={styles.cardExpand}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
          >
            {face === "oracle" ? (
              <div className={styles.oracleFace}>
                <p className={styles.oracleName}>{card.name}</p>
                {card.type_line && <p className={styles.oracleType}>{card.type_line}</p>}
                <div className={styles.oracleBody}>
                  {oracle == null ? "Loading oracle text…" : renderTextWithSymbols(oracle, 15)}
                </div>
              </div>
            ) : image ? (
              <img className={styles.cardExpandImg} src={image} alt={card.name} />
            ) : (
              <div className={styles.oracleFace}>
                <p className={styles.oracleName}>{card.name}</p>
                <div className={styles.oracleBody}>Loading card…</div>
              </div>
            )}
            <div className={styles.expandTools}>
              <p className={styles.swipeHint}>Swipe sideways for {face === "card" ? "oracle text" : "the card"}</p>
              <button
                type="button"
                className={styles.expandToggle}
                onClick={() => setFace((f) => (f === "card" ? "oracle" : "card"))}
              >
                {face === "card" ? "Oracle text" : "Card image"}
              </button>
            </div>
          </div>
        )}
      </div>
    </li>
  );
}
