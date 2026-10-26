import type { Dispatch, SetStateAction } from "react";
import { removeCardFromDeck, setCardBoard, setCardQuantity } from "../services/deckService";
import { sortCards } from "../lib/deck/boardHelpers";
import type { DeckBoard, DeckCard, DeckDetail } from "../types/deck";
import type { DeckToken } from "../lib/deck/deckTokens";

type Deps = {
  isOwner: boolean;
  panel: string;
  deckTokens: DeckToken[];
  setDeckTokens: Dispatch<SetStateAction<DeckToken[]>>;
  deckId: string | undefined;
  saveDeckTokens: (id: string, list: DeckToken[]) => void;
  patchCard: (cardId: string, patch: Partial<DeckCard> | null) => void;
  setError: (msg: string | null) => void;
  loadDeck: (opts?: { silent?: boolean }) => void | Promise<void>;
  snapshot: (label: string) => void;
  setDetail: Dispatch<SetStateAction<DeckDetail | null>>;
};

export function useDeckCardActions(deps: Deps) {
  const {
    isOwner,
    panel,
    deckTokens,
    setDeckTokens,
    deckId,
    saveDeckTokens,
    patchCard,
    setError,
    loadDeck,
    snapshot,
    setDetail,
  } = deps;

  async function applyQuantity(card: DeckCard, next: number) {
    if (!isOwner) return;
    if (panel === "tokens" || deckTokens.some((t) => t.id === card.id)) {
      setDeckTokens((prev) => {
        const nextList =
          next <= 0
            ? prev.filter((t) => t.id !== card.id)
            : prev.map((t) => (t.id === card.id ? { ...t, quantity: next } : t));
        if (deckId) saveDeckTokens(deckId, nextList);
        return nextList;
      });
      return;
    }
    const prevQty = card.quantity;
    if (next <= 0) {
      patchCard(card.id, null);
      const { error: err } = await removeCardFromDeck(card.id);
      if (err) {
        setError(err);
        patchCard(card.id, { quantity: prevQty });
        void loadDeck({ silent: true });
      }
      return;
    }
    patchCard(card.id, { quantity: next });
    const { error: err } = await setCardQuantity(card.id, next);
    if (err) {
      setError(err);
      patchCard(card.id, { quantity: prevQty });
    }
  }

  async function onQty(card: DeckCard, delta: number) {
    await applyQuantity(card, card.quantity + delta);
  }

  async function onQtyCommit(card: DeckCard, raw: string) {
    const n = parseInt(raw, 10);
    if (Number.isNaN(n)) return;
    await applyQuantity(card, n);
  }

  async function onRemove(card: DeckCard) {
    if (!isOwner) return;
    snapshot("Removed card");
    const removed = card;
    patchCard(card.id, null);
    const { error: err } = await removeCardFromDeck(card.id);
    if (err) {
      setError(err);
      setDetail((prev) =>
        prev ? { ...prev, cards: sortCards([...prev.cards, removed]) } : prev
      );
    }
  }

  async function moveCardToBoard(card: DeckCard, board: DeckBoard) {
    if (!isOwner || card.board === board) return;
    snapshot("Moved card");
    const { card: saved, removedId, error: err } = await setCardBoard(card, board);
    if (err || !saved) {
      setError(err ?? "Could not move card.");
      return;
    }
    setDetail((prev) => {
      if (!prev) return prev;
      let cards = prev.cards.filter((c) => c.id !== card.id && c.id !== removedId);
      const exists = cards.find((c) => c.id === saved.id);
      if (exists) {
        cards = cards.map((c) =>
          c.id === saved.id ? { ...c, ...saved, tag_ids: c.tag_ids ?? saved.tag_ids } : c
        );
      } else {
        cards = [...cards, { ...saved, tag_ids: card.tag_ids ?? saved.tag_ids ?? [] }];
      }
      return { ...prev, cards: sortCards(cards) };
    });
  }

  return { applyQuantity, onQty, onQtyCommit, onRemove, moveCardToBoard };
}
