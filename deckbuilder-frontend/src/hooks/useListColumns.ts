import { useCallback } from "react";
import {
  getListColumnLayout,
  newListColumnId,
  setListColumnLayout,
  type ListColumnLayout,
} from "../lib/deckPreferences";
import type { DeckBoard } from "../types/deck";

type Layouts = Record<string, ListColumnLayout>;

export function useListColumns(
  deckId: string | undefined,
  listLayouts: Layouts,
  setListLayouts: React.Dispatch<React.SetStateAction<Layouts>>
) {
  const persistListLayout = useCallback(
    (board: DeckBoard, layout: ListColumnLayout) => {
      if (!deckId) return;
      setListLayouts((prev) => ({ ...prev, [board]: layout }));
      setListColumnLayout(deckId, board, layout);
    },
    [deckId, setListLayouts]
  );

  const renameListColumn = useCallback(
    (board: DeckBoard, colId: string, name: string) => {
      const layout = listLayouts[board] ?? getListColumnLayout(deckId ?? "", board);
      persistListLayout(board, {
        ...layout,
        columns: layout.columns.map((c) => (c.id === colId ? { ...c, name } : c)),
      });
    },
    [listLayouts, deckId, persistListLayout]
  );

  const addListColumn = useCallback(
    (board: DeckBoard) => {
      const layout = listLayouts[board] ?? getListColumnLayout(deckId ?? "", board);
      const id = newListColumnId();
      persistListLayout(board, {
        ...layout,
        columns: [...layout.columns, { id, name: "New column" }],
      });
    },
    [listLayouts, deckId, persistListLayout]
  );

  const placeCardInListColumn = useCallback(
    (board: DeckBoard, cardId: string, colId: string) => {
      const layout = listLayouts[board] ?? getListColumnLayout(deckId ?? "", board);
      persistListLayout(board, {
        ...layout,
        placement: { ...layout.placement, [cardId]: colId },
      });
    },
    [listLayouts, deckId, persistListLayout]
  );

  const removeListColumn = useCallback(
    (board: DeckBoard, colId: string) => {
      const layout = listLayouts[board] ?? getListColumnLayout(deckId ?? "", board);
      if (layout.columns.length <= 1) return;
      const remaining = layout.columns.filter((c) => c.id !== colId);
      const fallback = remaining[0].id;
      const placement = { ...layout.placement };
      for (const [cardId, cid] of Object.entries(placement)) {
        if (cid === colId) placement[cardId] = fallback;
      }
      persistListLayout(board, { columns: remaining, placement });
    },
    [listLayouts, deckId, persistListLayout]
  );

  const createColumnAndPlace = useCallback(
    (board: DeckBoard, cardId: string) => {
      const layout = listLayouts[board] ?? getListColumnLayout(deckId ?? "", board);
      const id = newListColumnId();
      persistListLayout(board, {
        columns: [...layout.columns, { id, name: "New column" }],
        placement: { ...layout.placement, [cardId]: id },
      });
    },
    [listLayouts, deckId, persistListLayout]
  );

  return {
    persistListLayout,
    renameListColumn,
    addListColumn,
    placeCardInListColumn,
    removeListColumn,
    createColumnAndPlace,
  };
}
