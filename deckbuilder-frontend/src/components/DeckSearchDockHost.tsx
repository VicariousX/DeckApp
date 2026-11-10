import { DeckSearchDock } from "./search/DeckSearchDock";
import type { ScryfallCard } from "../types/scryfallCard";
import type { DeckCard } from "../types/deck";

type Props = {
  open: boolean;
  cards: DeckCard[];
  colorIdentity: boolean;
  commanderColorIdentity: string[];
  onAddCard: (c: ScryfallCard) => void;
  onUndoAdd: (c: ScryfallCard) => void;
  onClose: () => void;
};

export function DeckSearchDockHost({
  open, cards, colorIdentity, commanderColorIdentity,
  onAddCard, onUndoAdd, onClose,
}: Props) {
  const seedQuery = (() => {
    if (!colorIdentity) return undefined;
    const hasCommander = cards.some((c) => c.board === "commander");
    if (!hasCommander) return undefined;
    return commanderColorIdentity.length
      ? `id<=${commanderColorIdentity.join("").toLowerCase()}`
      : "id:c";
  })();

  return (
    <DeckSearchDock
      open={open}
      onAddCard={onAddCard}
      countInDeck={(c) =>
        cards
          .filter((x) => x.oracle_id.toLowerCase() === (c.oracle_id ?? c.id).toLowerCase())
          .reduce((n, x) => n + x.quantity, 0)
      }
      onUndoAdd={onUndoAdd}
      onClose={onClose}
      seedQuery={seedQuery}
    />
  );
}
