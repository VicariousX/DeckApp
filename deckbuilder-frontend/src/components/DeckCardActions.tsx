import { CardContextMenu } from "./CardContextMenu";
import { CardEnlargeOverlay } from "./CardImage";
import type { DeckCard, DeckBoard, DeckToken } from "../types/deck";
import type { ListColumnLayout } from "../lib/deckPreferences";
import { getListColumnLayout } from "../lib/deckPreferences";
import styles from "../pages/DeckBuilderPage.module.css";

type Board = { id: DeckBoard; label: string };

type Props = {
  imageActionId: string | null;
  imageActionPos: { x: number; y: number };
  isMobile: boolean;
  viewMode: string;
  detail: { cards: DeckCard[]; deck: { id: string } } | null;
  tokenCards: DeckCard[];
  ctxMenu: { x: number; y: number; card: DeckCard } | null;
  enhanceCard: DeckCard | null;
  isOwner: boolean;
  panel: string;
  groupMode: string;
  listLayouts: Partial<Record<DeckBoard, ListColumnLayout>>;
  boards: Board[];
  deckTokens: DeckToken[];
  stackImageSrc: (c: DeckCard) => string | undefined;
  onCloseMenu: () => void;
  onOpenMenu: (x: number, y: number, card: DeckCard) => void;
  onEnhance: (c: DeckCard) => void;
  onCloseEnhance: () => void;
  onOpenModal: (c: DeckCard, jump?: string) => void;
  onQty: (c: DeckCard, d: number) => void;
  onRemove: (c: DeckCard) => void;
  onApplyQuantity: (c: DeckCard, q: number) => void;
  moveCardToBoard: (c: DeckCard, board: DeckBoard) => void;
  placeCardInListColumn: (board: DeckBoard, cardId: string, colId: string) => void;
};

export function DeckCardActions({
  imageActionId, imageActionPos, isMobile, viewMode, detail, tokenCards,
  ctxMenu, enhanceCard, isOwner, panel, groupMode, listLayouts, boards,
  deckTokens, stackImageSrc, onCloseMenu, onOpenMenu, onEnhance, onCloseEnhance,
  onOpenModal, onQty, onRemove, onApplyQuantity, moveCardToBoard, placeCardInListColumn,
}: Props) {
  const liveCard = (id: string) =>
    detail?.cards.find((c) => c.id === id) ?? tokenCards.find((c) => c.id === id);

  return (
    <>
      {imageActionId && isMobile && viewMode === "image" && (() => {
        const card = liveCard(imageActionId);
        if (!card) return null;
        return (
          <button
            type="button"
            className={styles.imageMoreBtn}
            data-image-more=""
            style={{ left: imageActionPos.x, top: imageActionPos.y }}
            aria-label={`Options for ${card.name}`}
            onClick={() => onOpenMenu(imageActionPos.x, imageActionPos.y + 40, card)}
          >
            ⋮
          </button>
        );
      })()}
      {ctxMenu && (
        <CardContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          target={{
            scryfallId: ctxMenu.card.scryfall_id,
            oracleId: ctxMenu.card.oracle_id,
            name: ctxMenu.card.name,
            typeLine: ctxMenu.card.type_line,
            imageUrl: stackImageSrc(ctxMenu.card),
          }}
          quantity={(liveCard(ctxMenu.card.id) ?? ctxMenu.card).quantity}
          onClose={onCloseMenu}
          moveTargets={
            isOwner
              ? [
                  ...boards.map((b) => ({
                    label: b.label,
                    onSelect: () => void moveCardToBoard(ctxMenu.card, b.id),
                  })),
                  ...(groupMode === "none" && detail
                    ? boards.flatMap((b) => {
                        const layout = listLayouts[b.id] ?? getListColumnLayout(detail.deck.id, b.id);
                        return layout.columns.map((col) => ({
                          label: `${b.label}: ${col.name}`,
                          onSelect: () => {
                            void (async () => {
                              if (ctxMenu.card.board !== b.id) await moveCardToBoard(ctxMenu.card, b.id);
                              placeCardInListColumn(b.id, ctxMenu.card.id, col.id);
                            })();
                          },
                        }));
                      })
                    : []),
                ]
              : undefined
          }
          onEnhance={() => onEnhance(ctxMenu.card)}
          onOpenModal={(jump) => onOpenModal(ctxMenu.card, jump)}
          onQty={isOwner ? (d) => void onQty(liveCard(ctxMenu.card.id) ?? ctxMenu.card, d) : undefined}
          onRemove={
            isOwner
              ? () => {
                  const live = liveCard(ctxMenu.card.id) ?? ctxMenu.card;
                  if (panel === "tokens" || deckTokens.some((t) => t.id === live.id)) {
                    void onApplyQuantity(live, 0);
                  } else {
                    void onRemove(live);
                  }
                }
              : undefined
          }
        />
      )}
      {enhanceCard && (
        <CardEnlargeOverlay
          frontSrc={stackImageSrc(enhanceCard) || ""}
          frontName={enhanceCard.name}
          onClose={onCloseEnhance}
          onActivate={() => { onOpenModal(enhanceCard); onCloseEnhance(); }}
          hint="Click the card for details · click outside to close"
        />
      )}
    </>
  );
}
