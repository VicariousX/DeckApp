import { useEffect, useRef, useState, type TouchEvent } from "react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { ManaCost } from "./ManaCost";
import { renderTextWithSymbols } from "../utils/symbols";
import type { DeckCard, DeckBoard } from "../types/deck";
import { DroppableRegion, cardDragId, listColDropId, listColNewDropId } from "./ImageDeckDnd";
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
  groupMode: "type" | "tag" | "none" | "grid";
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
  dragList?: boolean;
  onRenameColumn?: (board: DeckBoard, colId: string, name: string) => void;
  onAddColumn?: (board: DeckBoard) => void;
  onRemoveColumn?: (board: DeckBoard, colId: string) => void;
};

function isBasicLand(c: DeckCard) {
  const type = c.type_line.toLowerCase();
  return type.includes("basic") && type.includes("land");
}

export function DeckTextView({
  displaySections, groupMode, addTargetBoard, isOwner, issuesByOracle,
  expandedId, oracleById, imageFor,
  onToggleOracle, onCardContext, onQty, onMore,
  dragList, onRenameColumn, onAddColumn, onRemoveColumn,
}: Props) {
  const visible = displaySections.filter((board) => {
    if (board.cards.length > 0) return true;
    if (board.id === "commander" || board.id === "main") return true;
    return board.id === addTargetBoard;
  });

  return (
    <div className={styles.imageBoardLayout}>
      {visible.map((board) => {
        const commander = board.id === "commander";
        return (
        <section
          key={board.id}
          className={commander ? styles.commanderSlot : styles.imageBoard}
          data-board={board.id}
        >
          <header className={commander ? styles.commanderSlotHeader : styles.stackHeader}>
            <h2 className={commander ? styles.commanderSlotTitle : styles.stackTitle}>{board.label}</h2>
            <span className={styles.stackCount}>{board.count}</span>
          </header>
          {board.cards.length === 0 && (groupMode !== "none" || board.id === "commander") ? (
            <p className={styles.boardZoneEmpty}>
              {board.id === "commander"
                ? "Choose a commander with the field above."
                : board.id === "main"
                  ? "Add cards using the field above."
                  : "Add cards to this board."}
            </p>
          ) : (
            <div className={groupMode === "none" && board.id !== "commander" ? `${styles.groups} ${styles.groupsColumns}` : styles.groups}>
              {(() => {
                const columnar = groupMode === "none" && board.id !== "commander";
                return (
                  <>
              {board.groups.map((g) => {
                const count = g.cards.reduce((n, c) => n + c.quantity, 0);
                const column = (
                  <>
                    {columnar ? (
                      <header className={styles.listColHead}>
                        {isOwner ? (
                          <input
                            className={styles.listColName}
                            value={g.label || "Cards"}
                            aria-label="Column name"
                            onChange={(e) => onRenameColumn?.(board.id, g.key, e.target.value)}
                          />
                        ) : (
                          <h3 className={styles.listColNameStatic}>{g.label || "Cards"}</h3>
                        )}
                        <span className={styles.groupCount}>{count}</span>
                        {isOwner && board.groups.length > 1 ? (
                          <button
                            type="button"
                            className={styles.listColRemove}
                            aria-label={`Remove ${g.label || "column"}`}
                            onClick={() => onRemoveColumn?.(board.id, g.key)}
                          >
                            ×
                          </button>
                        ) : null}
                      </header>
                    ) : g.label ? (
                      <h3 className={styles.groupTitle}>
                        {g.label}
                        <span className={styles.groupCount}>{count}</span>
                      </h3>
                    ) : null}
                    {g.cards.length === 0 ? (
                      <p className={styles.boardZoneEmpty}>{columnar ? "Drop cards here" : "Empty"}</p>
                    ) : (
                      <ul className={styles.cardList}>
                        {g.cards.map((c) => (
                          <TextRow
                            key={c.id}
                            card={c}
                            drag={Boolean(dragList) && columnar}
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
                    )}
                  </>
                );
                if (!columnar || !isOwner) {
                  return (
                    <div key={`${board.id}-${g.key}`} className={`${styles.group}${columnar ? ` ${styles.listCol}` : ""}`}>
                      {column}
                    </div>
                  );
                }
                return (
                  <DroppableRegion
                    key={`${board.id}-${g.key}`}
                    id={listColDropId(board.id, g.key)}
                    className={`${styles.group} ${styles.listCol}`}
                    activeClassName={styles.listColDrop}
                    disabled={!isOwner}
                  >
                    {column}
                  </DroppableRegion>
                );
              })}
              {columnar && isOwner ? (
                <DroppableRegion
                  id={listColNewDropId(board.id)}
                  className={styles.listColAddWrap}
                  activeClassName={styles.listColDrop}
                >
                  <button
                    type="button"
                    className={styles.listColAdd}
                    aria-label="Add column"
                    onClick={() => onAddColumn?.(board.id)}
                  >
                    +
                  </button>
                </DroppableRegion>
              ) : null}
                  </>
                );
              })()}
            </div>
          )}
        </section>
        );
      })}
    </div>
  );
}

function TextRow(props: {
  card: DeckCard;
  drag?: boolean;
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
  if (props.drag) return <DraggableTextRow {...props} />;
  return <TextRowBody {...props} />;
}

function DraggableTextRow(props: {
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
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: cardDragId(props.card.id),
  });
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: cardDragId(props.card.id),
  });
  return (
    <TextRowBody
      {...props}
      rowRef={(node) => {
        setNodeRef(node);
        setDropRef(node);
      }}
      dragging={isDragging}
      over={isOver}
      dragProps={{ ...listeners, ...attributes }}
    />
  );
}

function TextRowBody({
  card, illegal, open, oracle, image, isOwner, onToggle, onContext, onQty, onMore,
  rowRef, dragging, over, dragProps,
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
  rowRef?: (node: HTMLElement | null) => void;
  dragging?: boolean;
  over?: boolean;
  dragProps?: Record<string, unknown>;
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
    <li
      ref={rowRef}
      className={`${styles.cardRow}${dragProps ? ` ${styles.cardRowDrag}` : ""}${illegal ? ` ${styles.cardRowIllegal}` : ""}${open ? ` ${styles.cardRowOpen}` : ""}${over && !dragging ? ` ${styles.cardRowDrop}` : ""}`}
      style={dragging ? { opacity: 0.35 } : undefined}
      {...dragProps}
    >
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
            <span className={styles.qtyCompact} onPointerDown={(e) => e.stopPropagation()}>
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
            onPointerDown={(e) => e.stopPropagation()}
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
            onPointerDown={(e) => e.stopPropagation()}
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
