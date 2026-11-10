import {
  ImageDndProvider,
  DroppableRegion,
  DraggableStackCard,
  StackCards,
  boardDropId,
  stopDndPropagation,
} from "./ImageDeckDnd";
import type { DeckCard, DeckBoard } from "../types/deck";
import type { ListColumnLayout } from "../lib/deckPreferences";
import { getListColumnLayout } from "../lib/deckPreferences";
import styles from "../pages/DeckBuilderPage.module.css";

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
  mobileDropZones: { id: string; label: string }[];
  tokenCards: DeckCard[];
  stackImageSrc: (c: DeckCard) => string | undefined;
  looksMultiFace: (c: DeckCard) => boolean;
  onImageCardTap: (c: DeckCard, el: HTMLElement) => void;
  openCardModal: (c: DeckCard) => void;
  onCardContext: (e: { preventDefault: () => void; clientX: number; clientY: number }, c: DeckCard) => void;
  onQty: (c: DeckCard, d: number) => void;
  toggleStackFace: (c: DeckCard, e: unknown) => void;
  handleImageDrop: (sourceCardId: string, target: unknown) => void;
  faceView: Record<string, "front" | "back">;
};

export function DeckImageView({
  panel, isOwner, isMobile, groupMode, displaySections, listLayouts, deckId,
  issuesByOracle, mobileDropZones, tokenCards, stackImageSrc, looksMultiFace,
  onImageCardTap, openCardModal, onCardContext, onQty, toggleStackFace,
  handleImageDrop, faceView,
}: Props) {
  return (
    <ImageDndProvider
      enabled={isOwner && panel === "deck"}
      isMobile={isMobile}
      mobileZones={mobileDropZones}
      onDropCard={handleImageDrop}
      renderOverlay={(cardId) => {
        const c = tokenCards.find((x) => x.id === cardId);
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
          <img src={src} alt={c.name} className={styles.dndOverlayImg} draggable={false} />
        ) : (
          <div className={styles.stackCardPlaceholder}>{c.name}</div>
        );
      }}
    >
      <div className={styles.imageBoardLayout}>
        {displaySections.map((board) => {
          const isCommander = panel === "deck" && board.id === "commander";
          const useListCols = groupMode === "none";
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
                <header className={styles.commanderSlotHeader}>
                  <h2 className={styles.commanderSlotTitle}>Commander</h2>
                  <span className={styles.boardZoneCount}>{board.count}</span>
                </header>
                <div className={styles.commanderSlotCards}>
                  {board.cards.slice(0, 3).map((c, cardIdx) => {
                    const src = stackImageSrc(c);
                    return (
                      <DraggableStackCard
                        key={c.id}
                        card={c}
                        disabled={!isOwner}
                        className={`${styles.commanderCard}${issuesByOracle.has(c.oracle_id.toLowerCase()) ? ` ${styles.stackIllegal}` : ""}`}
                        style={{ zIndex: cardIdx + 1 }}
                        onClick={(e) => {
                          if (isMobile) {
                            onImageCardTap(c, e.currentTarget as HTMLElement);
                            return;
                          }
                          openCardModal(c);
                        }}
                        onContextMenu={(e) => {
                          if (isMobile) { e.preventDefault(); return; }
                          onCardContext(e, c);
                        }}
                      >
                        <div className={styles.stackCardLink} title={c.name}>
                          {src ? (
                            <img src={src} alt={c.name} className={styles.commanderCardImg} loading="lazy" draggable={false} />
                          ) : (
                            <div className={styles.stackCardPlaceholder}>{c.name}</div>
                          )}
                        </div>
                        {c.quantity > 1 && <span className={styles.stackQty}>×{c.quantity}</span>}
                        {looksMultiFace(c) && (
                          <button
                            type="button"
                            className={styles.faceFlip}
                            onClick={(e) => { e.stopPropagation(); toggleStackFace(c, e); }}
                          >
                            {faceView[c.id] === "back" ? "Front" : "Back"}
                          </button>
                        )}
                      </DraggableStackCard>
                    );
                  })}
                </div>
              </DroppableRegion>
            );
          }

          return (
            <DroppableRegion
              key={board.id}
              id={boardDropId(board.id)}
              dataBoard={board.id}
              className={styles.stackColumn}
              activeClassName={styles.stackColumnDropActive}
              disabled={!isOwner}
            >
              <header className={styles.stackColumnHeader}>
                <h2 className={styles.stackColumnTitle}>{board.label}</h2>
                <span className={styles.boardZoneCount}>{board.count}</span>
              </header>
              {board.cards.length === 0 ? (
                <p className={styles.boardZoneEmpty}>No cards on this board.</p>
              ) : useListCols ? (
                <div className={styles.listCols}>
                  {layout.columns.map((col) => (
                    <section key={col.id} className={styles.listCol}>
                      <h3 className={styles.listColTitle}>{col.name}</h3>
                      <StackCards>
                        {board.cards.filter((c) => (layout.placement[c.id] ?? "col-default") === col.id).map((c) => {
                          const src = stackImageSrc(c);
                          return (
                            <DraggableStackCard
                              key={c.id}
                              card={c}
                              disabled={!isOwner}
                              className={`${styles.stackCard}${issuesByOracle.has(c.oracle_id.toLowerCase()) ? ` ${styles.stackIllegal}` : ""}`}
                              onClick={(e) => {
                                if (isMobile) { onImageCardTap(c, e.currentTarget as HTMLElement); return; }
                                openCardModal(c);
                              }}
                              onContextMenu={(e) => {
                                if (isMobile) { e.preventDefault(); return; }
                                onCardContext(e, c);
                              }}
                            >
                              <div className={styles.stackCardLink} title={c.name}>
                                {src ? (
                                  <img src={src} alt={c.name} className={styles.stackCardImg} loading="lazy" draggable={false} />
                                ) : (
                                  <div className={styles.stackCardPlaceholder}>{c.name}</div>
                                )}
                              </div>
                              {c.quantity > 1 && <span className={styles.stackQty}>×{c.quantity}</span>}
                              {isOwner && (
                                <div className={styles.stackQtyControls}>
                                  <button type="button" className={styles.stackQtyBtn} onClick={(e) => { e.stopPropagation(); stopDndPropagation(e); void onQty(c, -1); }}>−</button>
                                  <button type="button" className={styles.stackQtyBtn} onClick={(e) => { e.stopPropagation(); stopDndPropagation(e); void onQty(c, 1); }}>+</button>
                                </div>
                              )}
                            </DraggableStackCard>
                          );
                        })}
                      </StackCards>
                    </section>
                  ))}
                </div>
              ) : (
                <StackCards>
                  {board.cards.map((c) => {
                    const src = stackImageSrc(c);
                    return (
                      <DraggableStackCard
                        key={c.id}
                        card={c}
                        disabled={!isOwner}
                        className={`${styles.stackCard}${issuesByOracle.has(c.oracle_id.toLowerCase()) ? ` ${styles.stackIllegal}` : ""}`}
                        onClick={(e) => {
                          if (isMobile) { onImageCardTap(c, e.currentTarget as HTMLElement); return; }
                          openCardModal(c);
                        }}
                        onContextMenu={(e) => {
                          if (isMobile) { e.preventDefault(); return; }
                          onCardContext(e, c);
                        }}
                      >
                        <div className={styles.stackCardLink} title={c.name}>
                          {src ? (
                            <img src={src} alt={c.name} className={styles.stackCardImg} loading="lazy" draggable={false} />
                          ) : (
                            <div className={styles.stackCardPlaceholder}>{c.name}</div>
                          )}
                        </div>
                        {c.quantity > 1 && <span className={styles.stackQty}>×{c.quantity}</span>}
                        {isOwner && (
                          <div className={styles.stackQtyControls}>
                            <button type="button" className={styles.stackQtyBtn} onClick={(e) => { e.stopPropagation(); stopDndPropagation(e); void onQty(c, -1); }}>−</button>
                            <button type="button" className={styles.stackQtyBtn} onClick={(e) => { e.stopPropagation(); stopDndPropagation(e); void onQty(c, 1); }}>+</button>
                          </div>
                        )}
                      </DraggableStackCard>
                    );
                  })}
                </StackCards>
              )}
            </DroppableRegion>
          );
        })}
      </div>
    </ImageDndProvider>
  );
}
