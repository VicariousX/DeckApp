import { CardInspectorModal } from "./CardInspectorModal";
import { initialTabFromJump, modalJumpFromState, type ModalJump } from "./CardContextMenu";
import type { DeckCard, DeckTag, DeckBoard } from "../types/deck";

type Props = {
  modalCard: DeckCard | null;
  modalJump: ModalJump;
  imageUrl: string | undefined;
  modalIndex: number;
  modalNavList: DeckCard[];
  detail: { cards: DeckCard[]; tags: DeckTag[] } | null;
  isOwner: boolean;
  deckId: string | undefined;
  onClose: () => void;
  onJumpChange: (jump: ModalJump) => void;
  onPrev: () => void;
  onNext: () => void;
  onQty: (c: DeckCard, d: number) => void;
  onBoard: (c: DeckCard, b: DeckBoard) => void;
  onRemove: (c: DeckCard) => void;
  onToggleTag: (c: DeckCard, tag: DeckTag) => void;
  onCreateTag: (name: string) => Promise<DeckTag | null>;
};

export function DeckInspectorHost({
  modalCard, modalJump, imageUrl, modalIndex, modalNavList, detail, isOwner, deckId,
  onClose, onJumpChange, onPrev, onNext, onQty, onBoard, onRemove, onToggleTag, onCreateTag,
}: Props) {
  if (!modalCard) return null;
  const live = detail?.cards.find((c) => c.id === modalCard.id) ?? modalCard;
  return (
    <CardInspectorModal
      key={modalCard.id}
      initialTab={initialTabFromJump(modalJump)}
      initialInfoSub={modalJump === "info:rulings" ? "rulings" : "details"}
      initialArtSub={modalJump === "artwork:upload" ? "upload" : modalJump === "artwork:proxy" ? "proxy" : "prints"}
      onTabChange={(tab, infoSub, artSub) => onJumpChange(modalJumpFromState(tab, infoSub, artSub))}
      scryfallId={live.scryfall_id}
      name={live.name}
      imageUrl={imageUrl}
      onClose={onClose}
      hasPrev={modalIndex > 0}
      hasNext={modalIndex >= 0 && modalIndex < modalNavList.length - 1}
      onPrev={onPrev}
      onNext={onNext}
      deck={{
        card: live,
        deckId,
        isOwner,
        tags: detail?.tags ?? [],
        onQty: (d) => void onQty(live, d),
        onBoard: (b) => void onBoard(live, b),
        onRemove: () => void onRemove(live),
        onToggleTag: (tag) => void onToggleTag(live, tag),
        onCreateTag: async (name) => {
          if (!deckId || !isOwner) return;
          await onCreateTag(name);
        },
      }}
    />
  );
}
