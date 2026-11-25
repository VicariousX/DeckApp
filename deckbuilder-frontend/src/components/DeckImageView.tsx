import type { MouseEvent, ReactNode } from "react";
import { useEffect, useState } from "react";
import {
  ImageDndProvider,
  DroppableRegion,
  DraggableStackCard,
  boardDropId,
  groupDropId,
  listColDropId,
  listColNewDropId,
  stopDndPropagation,
  type MobileDropZone,
  type DropTarget,
} from "./ImageDeckDnd";
import { RateLimitedImg } from "./RateLimitedImg";
import { StackCards } from "./StackCards";
import { isBasicLand } from "../lib/deck/boardHelpers";
import type { DeckCard, DeckBoard } from "../types/deck";
import type { ModalJump } from "./CardContextMenu";
import type { ListColumnLayout } from "../lib/deckPreferences";
import { useCardSize } from "./CardSizeSlider";
import styles from "../pages/DeckBuilderPage.module.css";
import { getListColumnLayout } from "../lib/deckPreferences";

type DisplaySection = {
  id: DeckBoard;
  label: string;
  count: number;
  cards: DeckCard[];
  groups: { key: string; label: string; cards: DeckCard[] }[];
};

type Props = {
  panel: "deck" | "tokens";
  isOwner: boolean;
  isMobile: boolean;
  groupMode: string;
  displaySections: DisplaySection[];
  listLayouts: Partial<Record<DeckBoard, ListColumnLayout>>;
  deckId: string;
  issuesByOracle: Map<string, unknown[]>;
  mobileDropZones: MobileDropZone[];
  desktopDropZones: MobileDropZone[];
  tokenCards: DeckCard[];
  stackImageSrc: (c: DeckCard) => string | undefined;
  looksMultiFace: (c: DeckCard) => boolean;
  onImageCardTap: (c: DeckCard, el: HTMLElement) => void;
  openCardModal: (c: DeckCard, jump?: ModalJump) => void;
  onBoard?: (c: DeckCard, board: DeckBoard) => void;
  onRemove?: (c: DeckCard) => void;
  onOpenScroll: (c: DeckCard) => void;
  onCardContext: (e: { preventDefault: () => void; clientX: number; clientY: number }, c: DeckCard) => void;
  onQty: (c: DeckCard, d: number) => void;
  toggleStackFace: (c: DeckCard, e: MouseEvent) => void;
  handleImageDrop: (sourceCardId: string, target: DropTarget) => void;
  faceView: Record<string, "front" | "back">;
  onRenameColumn?: (board: DeckBoard, colId: string, name: string) => void;
  onAddColumn?: (board: DeckBoard) => void;
  onRemoveColumn?: (board: DeckBoard, colId: string) => void;
};

function cardsInColumn(
  cards: DeckCard[],
  layout: ListColumnLayout,
  colId: string,
  isFirst: boolean
) {
  const ids = new Set(layout.columns.map((c) => c.id));
  return cards.filter((c) => {
    const placed = layout.placement[c.id];
    if (placed && ids.has(placed)) return placed === colId;
    return isFirst;
  });
}

export function DeckImageView({
  panel, isOwner, isMobile, groupMode, displaySections, listLayouts, deckId,
  issuesByOracle, mobileDropZones, desktopDropZones, tokenCards, stackImageSrc, looksMultiFace,
  onImageCardTap, openCardModal, onOpenScroll, onCardContext, onQty, onBoard, onRemove, toggleStackFace,
  handleImageDrop, faceView, onRenameColumn, onAddColumn, onRemoveColumn,
}: Props) {
  const cardSize = useCardSize("deck");
  const [peekCard, setPeekCard] = useState<DeckCard | null>(null);
  useEffect(() => {
    function clearPeek() {
      setPeekCard(null);
    }
    window.addEventListener("deckapp:unreveal", clearPeek);
    return () => window.removeEventListener("deckapp:unreveal", clearPeek);
  }, []);
  useEffect(() => {
    if (!peekCard) return;
    function onAway(e: PointerEvent) {
      const t = e.target as HTMLElement | null;
      if (!t) return;
      if (t.closest("[data-stack-idx]") || t.closest("[data-peek-ui]")) return;
      setPeekCard(null);
    }
    document.addEventListener("pointerdown", onAway);
    return () => document.removeEventListener("pointerdown", onAway);
  }, [peekCard]);
  const livePeek =
    displaySections.flatMap((section) => section.cards).find((card) => card.id === peekCard?.id) ??
    null;

  function stackOf(cards: DeckCard[], cardsNode: ReactNode) {
    const peekIndex =
      isMobile && livePeek ? cards.findIndex((card) => card.id === livePeek.id) : -1;
    return (
      <div className={styles.stackFrame}>
        <StackCards
          count={cards.length}
          revealIndex={isMobile ? (peekIndex >= 0 ? peekIndex : null) : undefined}
        >
          {cardsNode}
        </StackCards>
        {peekIndex >= 0 && livePeek ? (
          <div
            className={styles.peekSides}
            data-peek-ui=""
            style={{ top: `calc(${peekIndex} * var(--stack-peek))` }}
          >
            <div className={styles.peekLeft}>
              <span className={styles.peekInset} />
              {PEEK_BOARDS.map((board) => (
                <button
                  key={board.id}
                  type="button"
                  aria-pressed={livePeek.board === board.id}
                  className={livePeek.board === board.id ? styles.peekOn : undefined}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => onBoard?.(livePeek, board.id)}
                >
                  {board.label}
                </button>
              ))}
              {isOwner && onRemove ? (
                <button
                  type="button"
                  className={styles.peekRemove}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => onRemove(livePeek)}
                >
                  Remove
                </button>
              ) : null}
              <span className={styles.peekInset} />
            </div>
            <div className={styles.peekGap} />
            <div className={styles.peekRight}>
              <span className={styles.peekInset} />
              {isOwner ? (
                <div className={styles.peekQty}>
                  <button type="button" aria-label="Decrease quantity" onPointerDown={(e) => e.stopPropagation()} onClick={() => onQty(livePeek, -1)}>−</button>
                  <span>×{livePeek.quantity}</span>
                  <button type="button" aria-label="Increase quantity" onPointerDown={(e) => e.stopPropagation()} onClick={() => onQty(livePeek, 1)}>+</button>
                </div>
              ) : (
                <span className={styles.peekQty}>×{livePeek.quantity}</span>
              )}
              <div className={styles.peekTabStack}>
                {PEEK_TABS.map(([jump, label]) => (
                  <button
                    key={jump}
                    type="button"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => openCardModal(livePeek, jump)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <span className={styles.peekInset} />
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  function renderCard(c: DeckCard, index: number | undefined, variant: "stack" | "grid" | "commander") {
    const src = stackImageSrc(c);
    const illegal = issuesByOracle.has(c.oracle_id.toLowerCase());
    const frame =
      variant === "commander" ? styles.commanderCard :
      variant === "grid" ? styles.gridCard :
      styles.stackCard;
    const imgClass =
      variant === "commander" ? styles.commanderCardImg :
      variant === "grid" ? styles.gridCardImg :
      styles.stackCardImg;
    return (
      <DraggableStackCard
        key={c.id}
        card={c}
        stackIndex={variant === "stack" ? index : undefined}
        disabled={!isOwner}
        className={`${frame}${illegal ? ` ${styles.stackIllegal}` : ""}`}
        onPointerUp={() => {
          if (!isMobile || variant !== "stack") return;
          if (peekCard?.id === c.id) {
            setPeekCard(null);
            onOpenScroll(c);
            return;
          }
          setPeekCard(c);
        }}
        onClick={(e) => {
          if (isMobile && variant === "stack") {
            e.stopPropagation();
            return;
          }
          onOpenScroll(c);
        }}
        onContextMenu={(e) => {
          if (isMobile) { e.preventDefault(); return; }
          onCardContext(e, c);
        }}
      >
        <div className={styles.stackCardLink} title={c.name}>
          {src ? (
            <RateLimitedImg
              src={src}
              alt={c.name}
              className={imgClass}
              loading="lazy"
              draggable={false}
            />
          ) : (
            <div className={variant === "stack" ? styles.stackCardPlaceholder : imgClass}>{c.name}</div>
          )}
        </div>
        {c.quantity > 1 && <span className={styles.stackQty}>×{c.quantity}</span>}
        {looksMultiFace(c) && (
          <button
            type="button"
            className={styles.stackFlipBtn}
            onClick={(e) => { e.stopPropagation(); toggleStackFace(c, e); }}
          >
            {faceView[c.id] === "back" ? "Front" : "Back"}
          </button>
        )}
        {isOwner && isBasicLand(c) && (
          <div className={styles.stackCardControls}>
            <button type="button" className={styles.stackQtyBtn} onClick={(e) => { e.stopPropagation(); stopDndPropagation(e); void onQty(c, -1); }}>−</button>
            <button type="button" className={styles.stackQtyBtn} onClick={(e) => { e.stopPropagation(); stopDndPropagation(e); void onQty(c, 1); }}>+</button>
          </div>
        )}
      </DraggableStackCard>
    );
  }

  function renderStacks(columns: { key: string; label: string; cards: DeckCard[]; dropId: string }[]) {
    return (
      <div className={styles.stacksRow}>
        {columns.map((col) => (
          <DroppableRegion
            key={col.key}
            id={col.dropId}
            className={styles.stackColumn}
            activeClassName={styles.stackColumnDropActive}
            disabled={!isOwner}
          >
            {col.label ? (
            <header className={styles.stackHeader}>
              <h3 className={styles.stackTitle}>{col.label}</h3>
              <span className={styles.stackCount}>
                {col.cards.reduce((n, c) => n + c.quantity, 0)}
              </span>
            </header>
            ) : null}
            {col.cards.length === 0 ? (
              <p className={styles.boardZoneEmpty}>Empty</p>
            ) : (
              <>
              {stackOf(col.cards, col.cards.map((c, i) => renderCard(c, i, "stack")))}
              </>
            )}
          </DroppableRegion>
        ))}
      </div>
    );
  }

  return (
    <ImageDndProvider
      enabled={isOwner && panel === "deck"}
      isMobile={isMobile}
      mobileZones={mobileDropZones}
      desktopZones={desktopDropZones}
      onDropCard={handleImageDrop}
      renderOverlay={(cardId) => {
        const c =
          displaySections.flatMap((s) => s.cards).find((x) => x.id === cardId) ??
          tokenCards.find((x) => x.id === cardId);
        if (!c) return null;
        if (isMobile) {
          return (
            <div className={styles.dndOrb} aria-hidden>
              <span>{c.name.slice(0, 1)}</span>
            </div>
          );
        }
        const src = stackImageSrc(c);
        return src ? (
          <RateLimitedImg src={src} alt={c.name} className={styles.dndOverlayImg} draggable={false} />
        ) : (
          <div className={styles.stackCardPlaceholder}>{c.name}</div>
        );
      }}
    >
      <div className={styles.imageBoardLayout} style={{ ["--deck-card" as string]: `${cardSize}px` }}>
        {displaySections.map((board) => {
          const isCommander = panel === "deck" && board.id === "commander";
          const layout = listLayouts[board.id] ?? getListColumnLayout(deckId, board.id);

          if (isCommander) {
            return (
              <DroppableRegion
                key={board.id}
                id={boardDropId(board.id)}
                dataBoard={board.id}
                className={styles.commanderSlot}
                activeClassName={styles.stackColumnDropActive}
                disabled={!isOwner}
              >
                <div className={styles.commanderSlotCards}>
                  <p className={styles.commanderZoneLabel}>
                    {board.count > 1 ? "Commanders" : "Commander"}
                  </p>
                  {board.cards.slice(0, 3).map((c) => renderCard(c, undefined, "commander"))}
                </div>
              </DroppableRegion>
            );
          }

          let body: ReactNode;
          if (board.cards.length === 0 && groupMode !== "none") {
            body = <p className={styles.boardZoneEmpty}>No cards on this board.</p>;
          } else if (groupMode === "grid") {
            body = (
              <div className={styles.imageGrid}>
                {board.cards.map((c) => renderCard(c, undefined, "grid"))}
              </div>
            );
          } else if (groupMode === "none") {
            const cols = layout.columns;
            body = (
              <div className={styles.stacksRow}>
                {cols.map((col, i) => {
                  const cards = cardsInColumn(board.cards, layout, col.id, i === 0);
                  return (
                    <DroppableRegion
                      key={col.id}
                      id={listColDropId(board.id, col.id)}
                      className={styles.stackColumn}
                      activeClassName={styles.stackColumnDropActive}
                      disabled={!isOwner}
                    >
                      <header className={styles.stackHeader}>
                        {isOwner ? (
                          <input
                            className={styles.columnNameInput}
                            value={col.name}
                            aria-label="Column name"
                            onChange={(e) => onRenameColumn?.(board.id, col.id, e.target.value)}
                            onPointerDown={(e) => e.stopPropagation()}
                          />
                        ) : (
                          <h3 className={styles.stackTitle}>{col.name}</h3>
                        )}
                        <span className={styles.stackCount}>
                          {cards.reduce((n, c) => n + c.quantity, 0)}
                        </span>
                        {isOwner && cols.length > 1 ? (
                          <button
                            type="button"
                            className={styles.removeColumnBtn}
                            aria-label={`Remove ${col.name}`}
                            onClick={() => onRemoveColumn?.(board.id, col.id)}
                          >
                            ×
                          </button>
                        ) : null}
                      </header>
                      {cards.length === 0 ? (
                        <p className={styles.boardZoneEmpty}>Drop cards here</p>
                      ) : (
                        <>
                        {stackOf(cards, cards.map((c, idx) => renderCard(c, idx, "stack")))}
                        </>
                      )}
                    </DroppableRegion>
                  );
                })}
                {isOwner ? (
                  <DroppableRegion
                    id={listColNewDropId(board.id)}
                    className={`${styles.newColumnDrop} ${styles.newColumnDropVisible}`}
                    activeClassName={styles.newColumnDropActive}
                  >
                    <button
                      type="button"
                      className={styles.newColumnDropLabel}
                      onClick={() => onAddColumn?.(board.id)}
                    >
                      + Column
                    </button>
                  </DroppableRegion>
                ) : null}
              </div>
            );
          } else {
            body = renderStacks(
              board.groups.map((g) => ({
                key: g.key,
                label: board.id === "commander" ? "" : g.label,
                cards: g.cards,
                dropId: groupDropId(board.id, g.key),
              }))
            );
          }

          return (
            <DroppableRegion
              key={board.id}
              id={boardDropId(board.id)}
              dataBoard={board.id}
              className={styles.imageBoard}
              activeClassName={styles.stackColumnDropActive}
              disabled={!isOwner}
            >
              <header className={styles.stackHeader}>
                <h2 className={styles.stackTitle}>{board.label}</h2>
                <span className={styles.stackCount}>{board.count}</span>
              </header>
              {body}
            </DroppableRegion>
          );
        })}
      </div>
    </ImageDndProvider>
  );
}

const PEEK_BOARDS: { id: DeckBoard; label: string }[] = [
  { id: "commander", label: "Command" },
  { id: "main", label: "Main" },
  { id: "side", label: "Side" },
  { id: "maybe", label: "Maybe" },
];

const PEEK_TABS: [ModalJump, string][] = [
  ["info:rulings", "Rulings"],
  ["deck", "Deck"],
  ["drawers", "Drawers"],
  ["collections", "Collections"],
  ["mechanics", "Mechanics"],
  ["artwork", "Art"],
];
