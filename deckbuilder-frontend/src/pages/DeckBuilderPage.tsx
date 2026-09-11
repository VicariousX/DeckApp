import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type FormEvent,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { useArtPreferences } from "../auth/ArtPreferencesProvider";
import { ManaCost } from "../components/ManaCost";
import { fetchAutocomplete, fetchCardById, fetchNamedCard } from "../lib/scryfallApi";
import { getFaceImage, isMultiCard } from "../utils/scryfall";
import { primaryTypeGroup, sortTypeGroups } from "../lib/cards/cardTypes";
import {
  getDeckViewMode,
  getListColumnLayout,
  newListColumnId,
  setDeckViewMode,
  setLastViewedDeck,
  setListColumnLayout,
  type DeckViewMode,
  type ListColumnLayout,
} from "../lib/deckPreferences";
import { ensureUserCardFromScryfall } from "../services/userCardService";
import { useDeckCardHover } from "../hooks/useDeckCardHover";
import { CardHoverPreview } from "../components/CardHoverPreview";
import { DeckCardModal } from "../components/DeckCardModal";
import {
  addCardToDeck,
  createDeckTag,
  deleteDeckTag,
  fetchDeckDetail,
  removeCardFromDeck,
  reorderBoardCards,
  setCardBoard,
  setCardQuantity,
  setCardTag,
  stackDeckCards,
} from "../services/deckService";
import type { DeckBoard, DeckCard, DeckDetail, DeckTag } from "../types/deck";
import transitions from "../styles/pageTransitions.module.css";
import styles from "./DeckBuilderPage.module.css";

type GroupMode = "type" | "tag" | "none";
type PanelTab = "deck" | "stats" | "tokens" | "tags";

const BOARDS: { id: DeckBoard; label: string }[] = [
  { id: "commander", label: "Commander" },
  { id: "main", label: "Mainboard" },
  { id: "side", label: "Sideboard" },
  { id: "maybe", label: "Maybeboard" },
];

const PANEL_TABS: { id: PanelTab; label: string }[] = [
  { id: "deck", label: "Deck" },
  { id: "stats", label: "Stats" },
  { id: "tokens", label: "Tokens" },
  { id: "tags", label: "Tags" },
];

type CardGroup = { key: string; label: string; cards: DeckCard[] };

function sortCards(cards: DeckCard[]): DeckCard[] {
  return [...cards].sort((a, b) => {
    const so = (a.sort_order ?? 0) - (b.sort_order ?? 0);
    if (so !== 0) return so;
    return a.name.localeCompare(b.name);
  });
}

function buildGroups(
  cards: DeckCard[],
  groupMode: GroupMode,
  tags: DeckTag[]
): CardGroup[] {
  const sorted = sortCards(cards);
  if (groupMode === "none") {
    return [{ key: "all", label: "All cards", cards: sorted }];
  }
  if (groupMode === "type") {
    const map = new Map<string, DeckCard[]>();
    for (const c of sorted) {
      const g = primaryTypeGroup(c.type_line);
      const list = map.get(g) ?? [];
      list.push(c);
      map.set(g, list);
    }
    return sortTypeGroups([...map.keys()]).map((k) => ({
      key: k,
      label: k,
      cards: sortCards(map.get(k) ?? []),
    }));
  }
  const byTag = new Map<string, DeckCard[]>();
  const untagged: DeckCard[] = [];
  for (const c of sorted) {
    const ids = c.tag_ids ?? [];
    if (ids.length === 0) {
      untagged.push(c);
      continue;
    }
    for (const tid of ids) {
      const list = byTag.get(tid) ?? [];
      list.push(c);
      byTag.set(tid, list);
    }
  }
  const sections = tags
    .filter((t) => byTag.has(t.id))
    .map((t) => ({
      key: t.id,
      label: t.name,
      cards: sortCards(byTag.get(t.id) ?? []),
    }));
  if (untagged.length) {
    sections.push({
      key: "untagged",
      label: "Untagged",
      cards: sortCards(untagged),
    });
  }
  return sections;
}

export function DeckBuilderPage() {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const {
    hoverCard,
    hoverSrc,
    hoverPos,
    onNameEnter,
    onNameMove,
    onNameLeave,
    warmCache,
  } = useDeckCardHover();
  const { resolveImageUrl } = useArtPreferences();

  const [detail, setDetail] = useState<DeckDetail | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [groupMode, setGroupMode] = useState<GroupMode>("type");
  const [viewMode, setViewMode] = useState<DeckViewMode>(() => getDeckViewMode());
  const [panel, setPanel] = useState<PanelTab>("deck");
  const [addTargetBoard, setAddTargetBoard] = useState<DeckBoard>("main");
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [tagMenuCardId, setTagMenuCardId] = useState<string | null>(null);
  const [modalCard, setModalCard] = useState<DeckCard | null>(null);
  const dragMovedRef = useRef(false);
  /** stack face flip: card id → front|back */
  const [faceView, setFaceView] = useState<Record<string, "front" | "back">>({});
  /** cached back-face image URLs for multi-face cards */
  const [backUrls, setBackUrls] = useState<Record<string, string>>({});
  /** Images + List mode: freeform columns per board */
  const [listLayouts, setListLayouts] = useState<
    Partial<Record<DeckBoard, ListColumnLayout>>
  >({});

  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [addBusy, setAddBusy] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const [newTagName, setNewTagName] = useState("");

  const loadDeck = useCallback(async (opts?: { silent?: boolean }) => {
    if (!id) return;
    if (!opts?.silent) setInitialLoading(true);
    const { detail: d, error: err } = await fetchDeckDetail(id);
    setDetail(d);
    setError(err);
    if (!opts?.silent) setInitialLoading(false);
  }, [id]);

  useEffect(() => {
    void loadDeck();
  }, [loadDeck]);

  useEffect(() => {
    function onDoc(e: globalThis.MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setSuggestOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (q.length < 2) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      const { names } = await fetchAutocomplete(q);
      setSuggestions(names.slice(0, 10));
      setSuggestOpen(names.length > 0);
    }, 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);


  useEffect(() => {
    if (detail?.cards?.length) warmCache(detail.cards);
  }, [detail, warmCache]);

  // Remember last opened deck for the nav dropdown
  useEffect(() => {
    if (detail?.deck) {
      setLastViewedDeck({ id: detail.deck.id, name: detail.deck.name });
    }
  }, [detail?.deck]);

  // Load freeform list-column layouts for this deck
  useEffect(() => {
    if (!detail?.deck?.id) return;
    const next: Partial<Record<DeckBoard, ListColumnLayout>> = {};
    for (const b of BOARDS) {
      next[b.id] = getListColumnLayout(detail.deck.id, b.id);
    }
    setListLayouts(next);
  }, [detail?.deck?.id]);

  // Resolve preferred/custom art URLs for image view
  useEffect(() => {
    if (!detail?.cards?.length || viewMode !== "image") return;
    let cancelled = false;
    async function load() {
      const next: Record<string, string> = {};
      await Promise.all(
        detail!.cards.map(async (c) => {
          const url = await resolveImageUrl(
            c.oracle_id || c.scryfall_id,
            c.scryfall_id
          );
          if (url) next[c.id] = url;
        })
      );
      if (!cancelled) setImageUrls((prev) => ({ ...prev, ...next }));
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [detail, viewMode, resolveImageUrl]);

  function changeViewMode(mode: DeckViewMode) {
    setViewMode(mode);
    setDeckViewMode(mode);
  }


  const isOwner = Boolean(user && detail && detail.deck.user_id === user.id);

  const boardCounts = useMemo(() => {
    const counts: Record<DeckBoard, number> = {
      main: 0,
      side: 0,
      maybe: 0,
      commander: 0,
    };
    for (const c of detail?.cards ?? []) {
      counts[c.board] = (counts[c.board] ?? 0) + c.quantity;
    }
    return counts;
  }, [detail]);

  const totalCards = useMemo(
    () => (detail?.cards ?? []).reduce((n, c) => n + c.quantity, 0),
    [detail]
  );

  /** All boards with their cards + type/tag groups — shown together on Deck panel */
  const boardSections = useMemo(() => {
    if (!detail) return [] as {
      id: DeckBoard;
      label: string;
      cards: DeckCard[];
      groups: CardGroup[];
      count: number;
    }[];
    return BOARDS.map((b) => {
      const cards = sortCards(detail.cards.filter((c) => c.board === b.id));
      return {
        id: b.id,
        label: b.label,
        cards,
        groups: buildGroups(cards, groupMode, detail.tags),
        count: cards.reduce((n, c) => n + c.quantity, 0),
      };
    });
  }, [detail, groupMode]);

  function patchCard(cardId: string, patch: Partial<DeckCard> | null) {
    setDetail((prev) => {
      if (!prev) return prev;
      if (patch === null) {
        return {
          ...prev,
          cards: prev.cards.filter((c) => c.id !== cardId),
        };
      }
      return {
        ...prev,
        cards: prev.cards.map((c) =>
          c.id === cardId ? { ...c, ...patch } : c
        ),
      };
    });
  }

  async function addByName(name: string) {
    if (!id || !isOwner || !name.trim()) return;
    setAddBusy(true);
    setError(null);
    const { card, error: fetchErr } = await fetchNamedCard(name.trim());
    if (fetchErr || !card) {
      setError(fetchErr ?? "Card not found.");
      setAddBusy(false);
      return;
    }
    const oracleId = card.oracle_id ?? card.id;
    const { card: saved, error: addErr } = await addCardToDeck(id, {
      oracle_id: oracleId,
      scryfall_id: card.id,
      name: card.name,
      type_line: card.type_line,
      mana_cost: card.mana_cost,
      cmc: card.cmc,
      quantity: 1,
      board: addTargetBoard,
    });
    setAddBusy(false);
    if (addErr || !saved) {
      setError(addErr ?? "Could not add card.");
      return;
    }
    setQuery("");
    setSuggestOpen(false);
    // Cache local user_card row (background)
    if (user) {
      void ensureUserCardFromScryfall(user.id, card);
    }
    // Optimistic merge — no full-page reload
    setDetail((prev) => {
      if (!prev) return prev;
      const existing = prev.cards.find((c) => c.id === saved.id);
      if (existing) {
        return {
          ...prev,
          cards: sortCards(
            prev.cards.map((c) =>
              c.id === saved.id
                ? { ...c, quantity: saved.quantity, tag_ids: c.tag_ids }
                : c
            )
          ),
        };
      }
      return {
        ...prev,
        cards: sortCards([
          ...prev.cards,
          { ...saved, tag_ids: saved.tag_ids ?? [] },
        ]),
      };
    });
  }

  async function applyQuantity(card: DeckCard, next: number) {
    if (!isOwner) return;
    const prevQty = card.quantity;
    if (next <= 0) {
      patchCard(card.id, null);
      const { error: err } = await removeCardFromDeck(card.id);
      if (err) {
        setError(err);
        patchCard(card.id, { quantity: prevQty }); // rollback remove needs full card — reload silent
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
    const snapshot = card;
    patchCard(card.id, null);
    const { error: err } = await removeCardFromDeck(card.id);
    if (err) {
      setError(err);
      setDetail((prev) =>
        prev
          ? { ...prev, cards: sortCards([...prev.cards, snapshot]) }
          : prev
      );
    }
  }

  async function onCreateTag(e: FormEvent) {
    e.preventDefault();
    if (!id || !isOwner || !newTagName.trim()) return;
    const { tag, error: err } = await createDeckTag(id, newTagName.trim());
    if (err || !tag) {
      setError(err ?? "Could not create tag.");
      return;
    }
    setNewTagName("");
    setDetail((prev) =>
      prev ? { ...prev, tags: [...prev.tags, tag].sort((a, b) => a.name.localeCompare(b.name)) } : prev
    );
  }

  async function onDeleteTag(tag: DeckTag) {
    if (!isOwner) return;
    if (!confirm(`Delete tag “${tag.name}”?`)) return;
    const { error: err } = await deleteDeckTag(tag.id);
    if (err) {
      setError(err);
      return;
    }
    setDetail((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        tags: prev.tags.filter((t) => t.id !== tag.id),
        cards: prev.cards.map((c) => ({
          ...c,
          tag_ids: (c.tag_ids ?? []).filter((tid) => tid !== tag.id),
        })),
      };
    });
  }

  async function toggleTag(card: DeckCard, tag: DeckTag) {
    if (!isOwner) return;
    const has = (card.tag_ids ?? []).includes(tag.id);
    const nextIds = has
      ? (card.tag_ids ?? []).filter((t) => t !== tag.id)
      : [...(card.tag_ids ?? []), tag.id];
    patchCard(card.id, { tag_ids: nextIds });
    const { error: err } = await setCardTag(card.id, tag.id, !has);
    if (err) {
      setError(err);
      patchCard(card.id, { tag_ids: card.tag_ids });
    }
  }

  async function moveCardToBoard(card: DeckCard, board: DeckBoard) {
    if (!isOwner || card.board === board) return;
    const { card: saved, removedId, error: err } = await setCardBoard(card, board);
    if (err || !saved) {
      setError(err ?? "Could not move card.");
      return;
    }
    setDetail((prev) => {
      if (!prev) return prev;
      // Remove source (and merge target if different)
      let cards = prev.cards.filter(
        (c) => c.id !== card.id && c.id !== removedId
      );
      const exists = cards.find((c) => c.id === saved.id);
      if (exists) {
        cards = cards.map((c) =>
          c.id === saved.id
            ? { ...c, ...saved, tag_ids: c.tag_ids ?? saved.tag_ids }
            : c
        );
      } else {
        cards = [
          ...cards,
          { ...saved, tag_ids: card.tag_ids ?? saved.tag_ids ?? [] },
        ];
      }
      return { ...prev, cards: sortCards(cards) };
    });
  }


  function persistListLayout(board: DeckBoard, layout: ListColumnLayout) {
    if (!detail?.deck?.id) return;
    setListLayouts((prev) => ({ ...prev, [board]: layout }));
    setListColumnLayout(detail.deck.id, board, layout);
  }

  function renameListColumn(board: DeckBoard, colId: string, name: string) {
    const layout = listLayouts[board] ?? getListColumnLayout(detail!.deck.id, board);
    persistListLayout(board, {
      ...layout,
      columns: layout.columns.map((c) =>
        c.id === colId ? { ...c, name } : c
      ),
    });
  }

  function addListColumn(board: DeckBoard) {
    const layout = listLayouts[board] ?? getListColumnLayout(detail!.deck.id, board);
    const id = newListColumnId();
    persistListLayout(board, {
      ...layout,
      columns: [...layout.columns, { id, name: "New column" }],
    });
  }

  function placeCardInListColumn(board: DeckBoard, cardId: string, colId: string) {
    const layout = listLayouts[board] ?? getListColumnLayout(detail!.deck.id, board);
    persistListLayout(board, {
      ...layout,
      placement: { ...layout.placement, [cardId]: colId },
    });
  }

  function removeListColumn(board: DeckBoard, colId: string) {
    const layout = listLayouts[board] ?? getListColumnLayout(detail!.deck.id, board);
    if (layout.columns.length <= 1) return;
    const remaining = layout.columns.filter((c) => c.id !== colId);
    const fallback = remaining[0].id;
    const placement = { ...layout.placement };
    for (const [cardId, cid] of Object.entries(placement)) {
      if (cid === colId) placement[cardId] = fallback;
    }
    persistListLayout(board, { columns: remaining, placement });
  }

  function createColumnAndPlace(board: DeckBoard, cardId: string) {
    const layout = listLayouts[board] ?? getListColumnLayout(detail!.deck.id, board);
    const id = newListColumnId();
    persistListLayout(board, {
      columns: [...layout.columns, { id, name: "New column" }],
      placement: { ...layout.placement, [cardId]: id },
    });
  }

  function looksMultiFace(card: DeckCard): boolean {
    if (backUrls[card.id]) return true;
    if (card.name.includes(" // ")) return true;
    const tl = (card.type_line ?? "").toLowerCase();
    return (
      tl.includes("transform") ||
      tl.includes("modal dfc") ||
      tl.includes("meld") ||
      tl.includes("prototype")
    );
  }

  async function toggleStackFace(card: DeckCard, e: MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    const current = faceView[card.id] ?? "front";
    if (current === "front") {
      let back = backUrls[card.id];
      if (!back) {
        const { card: sf } = await fetchCardById(card.scryfall_id);
        if (sf && isMultiCard(sf)) {
          back = getFaceImage(sf, 1) || "";
          if (back) {
            setBackUrls((prev) => ({ ...prev, [card.id]: back! }));
          }
        }
      }
      if (back) {
        setFaceView((prev) => ({ ...prev, [card.id]: "back" }));
      }
    } else {
      setFaceView((prev) => ({ ...prev, [card.id]: "front" }));
    }
  }

  function stackImageSrc(card: DeckCard): string | undefined {
    if ((faceView[card.id] ?? "front") === "back" && backUrls[card.id]) {
      return backUrls[card.id];
    }
    return imageUrls[card.id];
  }

  function cardsForListColumn(
    boardCards: DeckCard[],
    board: DeckBoard,
    colId: string,
    isFirst: boolean
  ): DeckCard[] {
    const layout = listLayouts[board];
    const placement = layout?.placement ?? {};
    const colIds = new Set((layout?.columns ?? []).map((c) => c.id));
    return boardCards.filter((c) => {
      const p = placement[c.id];
      if (p && colIds.has(p)) return p === colId;
      // Unassigned → first column
      return isFirst;
    });
  }

  function onTileDragStart(e: DragEvent, card: DeckCard) {
    if (!isOwner) return;
    dragMovedRef.current = false;
    setDragId(card.id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", card.id);
  }

  function onTileDrag() {
    dragMovedRef.current = true;
  }

  function openCardModal(card: DeckCard) {
    if (dragMovedRef.current || dragId) return;
    setModalCard(card);
  }

  function onTileDragOver(e: DragEvent, overCard: DeckCard) {
    if (!isOwner || !dragId || dragId === overCard.id) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverId(overCard.id);
  }

  function onTileDragLeave(overCard: DeckCard) {
    if (dragOverId === overCard.id) setDragOverId(null);
  }

  async function onTileDrop(e: DragEvent, target: DeckCard) {
    e.preventDefault();
    setDragOverId(null);
    const sourceId = dragId || e.dataTransfer.getData("text/plain");
    setDragId(null);
    if (!isOwner || !sourceId || sourceId === target.id || !detail) return;
    const dragged = detail.cards.find((c) => c.id === sourceId);
    if (!dragged || dragged.board !== target.board) return;

    // Same printing → stack
    if (dragged.scryfall_id === target.scryfall_id) {
      const { card: saved, error: err } = await stackDeckCards(target, dragged);
      if (err || !saved) {
        setError(err ?? "Could not stack cards.");
        return;
      }
      setDetail((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          cards: sortCards(
            prev.cards
              .filter((c) => c.id !== dragged.id)
              .map((c) =>
                c.id === saved.id
                  ? { ...c, quantity: saved.quantity }
                  : c
              )
          ),
        };
      });
      return;
    }

    // Reorder within board: place dragged before target
    const boardList = sortCards(
      detail.cards.filter((c) => c.board === target.board)
    );
    const without = boardList.filter((c) => c.id !== dragged.id);
    const targetIdx = without.findIndex((c) => c.id === target.id);
    const insertAt = targetIdx < 0 ? without.length : targetIdx;
    const nextOrder = [
      ...without.slice(0, insertAt),
      dragged,
      ...without.slice(insertAt),
    ];
    const orderedIds = nextOrder.map((c) => c.id);
    setDetail((prev) => {
      if (!prev) return prev;
      const orderMap = new Map(orderedIds.map((id, i) => [id, i]));
      return {
        ...prev,
        cards: prev.cards.map((c) =>
          orderMap.has(c.id)
            ? { ...c, sort_order: orderMap.get(c.id)! }
            : c
        ),
      };
    });
    const { error: err } = await reorderBoardCards(orderedIds);
    if (err) {
      setError(err);
      void loadDeck({ silent: true });
    }
  }

  function onTileDragEnd() {
    setDragId(null);
    setDragOverId(null);
    // Keep dragMoved true until after click handlers settle
    window.setTimeout(() => {
      dragMovedRef.current = false;
    }, 0);
  }

  async function onBoardTabDrop(e: DragEvent, board: DeckBoard) {
    e.preventDefault();
    const sourceId = dragId || e.dataTransfer.getData("text/plain");
    setDragId(null);
    setDragOverId(null);
    if (!isOwner || !sourceId || !detail) return;
    const card = detail.cards.find((c) => c.id === sourceId);
    if (!card || card.board === board) return;
    await moveCardToBoard(card, board);
  }

  if (!authLoading && !user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div
      className={`${transitions.page} ${styles.page}${
        viewMode === "image" ? ` ${styles.pageStacks}` : ""
      }`}
    >
      <div className={styles.topBar}>
        <Link to="/my-decks" className={styles.backLink}>
          ← My decks
        </Link>
      </div>

      {initialLoading && <p className={styles.status}>Loading deck…</p>}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      {!initialLoading && detail && (
        <>
          <header className={styles.header}>
            <div>
              <h1 className={styles.title}>{detail.deck.name}</h1>
              <p className={styles.meta}>
                <span className={styles.format}>{detail.deck.format}</span>
                <span>
                  {totalCards} card{totalCards === 1 ? "" : "s"} ·{" "}
                  {detail.cards.length} unique
                </span>
                <span className={styles.boardMeta}>
                  {BOARDS.map((b) => (
                    <span key={b.id}>
                      {b.label.replace("board", "")} {boardCounts[b.id]}
                    </span>
                  ))}
                </span>
              </p>
              {detail.deck.description && (
                <p className={styles.desc}>{detail.deck.description}</p>
              )}
            </div>
          </header>

          <div className={styles.boardTabs} role="tablist" aria-label="Panel">
            {PANEL_TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={panel === t.id}
                className={
                  panel === t.id
                    ? `${styles.boardTab} ${styles.boardTabActive}`
                    : styles.boardTab
                }
                onClick={() => setPanel(t.id)}
              >
                {t.label}
                {t.id === "tags" && detail.tags.length > 0 && (
                  <span className={styles.boardTabCount}>{detail.tags.length}</span>
                )}
              </button>
            ))}
          </div>

          {panel === "deck" && isOwner && (
            <section className={styles.addSection}>
              <h2 className={styles.sectionLabel}>Add card</h2>
              <div className={styles.addRow} ref={wrapRef}>
                <div className={styles.inputWrap}>
                  <input
                    className={styles.input}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void addByName(query.trim());
                      }
                    }}
                    placeholder="Card name…"
                    autoComplete="off"
                  />
                  {suggestOpen && suggestions.length > 0 && (
                    <ul className={styles.suggestList}>
                      {suggestions.map((n) => (
                        <li key={n}>
                          <button
                            type="button"
                            className={styles.suggestItem}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => void addByName(n)}
                          >
                            {n}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <select
                  className={styles.boardSelect}
                  value={addTargetBoard}
                  aria-label="Add to board"
                  onChange={(e) =>
                    setAddTargetBoard(e.target.value as DeckBoard)
                  }
                >
                  {BOARDS.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className={styles.primaryBtn}
                  disabled={addBusy || !query.trim()}
                  onClick={() => void addByName(query.trim())}
                >
                  {addBusy ? "Adding…" : "Add"}
                </button>
              </div>
            </section>
          )}

          {panel === "deck" && (
            <div className={styles.toolbar}>
              <div className={styles.groupToggle} role="group" aria-label="Group by">
                {(
                  [
                    ["type", "Type"],
                    ["tag", "Tags"],
                    ["none", "List"],
                  ] as const
                ).map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    className={
                      groupMode === mode
                        ? `${styles.groupBtn} ${styles.groupBtnActive}`
                        : styles.groupBtn
                    }
                    onClick={() => setGroupMode(mode)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div
                className={styles.groupToggle}
                role="group"
                aria-label="Deck view"
              >
                {(
                  [
                    ["text", "Text"],
                    ["image", "Images"],
                  ] as const
                ).map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    className={
                      viewMode === mode
                        ? `${styles.groupBtn} ${styles.groupBtnActive}`
                        : styles.groupBtn
                    }
                    onClick={() => changeViewMode(mode)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {panel === "tags" && (
            <section className={styles.tagsPanel}>
              <h2 className={styles.sectionLabel}>Deck tags</h2>
              <p className={styles.hint}>
                Create tags here, then pin them to individual cards from the deck
                list with <strong>Add tag</strong>.
              </p>
              {isOwner && (
                <form className={styles.tagForm} onSubmit={onCreateTag}>
                  <input
                    className={styles.input}
                    placeholder="New tag name"
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    maxLength={40}
                  />
                  <button type="submit" className={styles.secondaryBtn}>
                    Create tag
                  </button>
                </form>
              )}
              <div className={styles.tagChips}>
                {detail.tags.map((t) => (
                  <span key={t.id} className={styles.tagChip}>
                    {t.name}
                    {isOwner && (
                      <button
                        type="button"
                        className={styles.tagRemove}
                        onClick={() => void onDeleteTag(t)}
                        aria-label={`Delete ${t.name}`}
                      >
                        ×
                      </button>
                    )}
                  </span>
                ))}
                {detail.tags.length === 0 && (
                  <span className={styles.hint}>No tags yet.</span>
                )}
              </div>
            </section>
          )}

          {panel === "stats" && (
            <section className={styles.placeholderPanel}>
              <h2 className={styles.sectionLabel}>Deck stats</h2>
              <p className={styles.hint}>
                Mana curve, color distribution, and type counts will live here.
              </p>
              <ul className={styles.statsList}>
                {BOARDS.map((b) => (
                  <li key={b.id}>
                    <strong>{b.label}</strong>: {boardCounts[b.id]} cards
                  </li>
                ))}
                <li>
                  <strong>Total</strong>: {totalCards} cards (
                  {detail.cards.length} unique)
                </li>
                <li>
                  <strong>Tags</strong>: {detail.tags.length}
                </li>
              </ul>
            </section>
          )}

          {panel === "tokens" && (
            <section className={styles.placeholderPanel}>
              <h2 className={styles.sectionLabel}>Tokens</h2>
              <p className={styles.hint}>
                Token selection and tracking for this deck is coming soon.
              </p>
            </section>
          )}

          {panel === "deck" && viewMode === "image" && (
            <div className={styles.imageBoardLayout}>
              {boardSections.map((board) => {
                const isCommander = board.id === "commander";
                const useListCols = groupMode === "none";
                const layout =
                  listLayouts[board.id] ??
                  (detail
                    ? getListColumnLayout(detail.deck.id, board.id)
                    : { columns: [{ id: "col-default", name: "Cards" }], placement: {} });

                if (isCommander) {
                  return (
                    <div
                      key={board.id}
                      data-board={board.id}
                      className={styles.commanderSlot}
                      onDragOver={(e) => {
                        if (!isOwner || !dragId) return;
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "move";
                      }}
                      onDrop={(e) => void onBoardTabDrop(e, board.id)}
                    >
                      <header className={styles.commanderSlotHeader}>
                        <h2 className={styles.commanderSlotTitle}>Commander</h2>
                        <span className={styles.boardZoneCount}>{board.count}</span>
                      </header>
                      <div className={styles.commanderSlotCards}>
                        {board.cards.slice(0, 3).map((c, cardIdx) => {
                          const src = stackImageSrc(c);
                                  const multi = looksMultiFace(c);
                          const dragging = dragId === c.id;
                          return (
                            <div
                              key={c.id}
                              className={`${styles.commanderCard}${
                                dragging ? ` ${styles.stackCardDragging}` : ""
                              }`}
                              style={{ zIndex: cardIdx + 1 }}
                              draggable={isOwner}
                              onDragStart={(e) => onTileDragStart(e, c)}
                              onDrag={() => onTileDrag()}
                              onDragOver={(e) => onTileDragOver(e, c)}
                              onDragLeave={() => onTileDragLeave(c)}
                              onDrop={(e) => void onTileDrop(e, c)}
                              onDragEnd={onTileDragEnd}
                              onClick={() => openCardModal(c)}
                            >
                              <div
                                className={styles.stackCardLink}
                                title={c.name}
                              >
                                {src ? (
                                  <img
                                    src={src}
                                    alt={c.name}
                                    className={styles.commanderCardImg}
                                    loading="lazy"
                                    draggable={false}
                                  />
                                ) : (
                                  <div className={styles.stackCardPlaceholder}>
                                    {c.name}
                                  </div>
                                )}
                              </div>
                              {c.quantity > 1 && (
                                <span className={styles.stackQty}>×{c.quantity}</span>
                              )}
                              {looksMultiFace(c) && (
                                <button
                                  type="button"
                                  className={styles.stackFlipBtn}
                                  title="Flip card"
                                  aria-label={`Flip ${c.name}`}
                                  onClick={(e) => void toggleStackFace(c, e)}
                                >
                                  Flip
                                </button>
                              )}
                              {isOwner && (
                                <div className={styles.stackCardControls}>
                                  <button
                                    type="button"
                                    className={styles.stackQtyBtn}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      void onQty(c, -1);
                                    }}
                                    aria-label={`Decrease ${c.name}`}
                                  >
                                    −
                                  </button>
                                  <button
                                    type="button"
                                    className={styles.stackQtyBtn}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      void onQty(c, 1);
                                    }}
                                    aria-label={`Increase ${c.name}`}
                                  >
                                    +
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                        {board.cards.length === 0 && (
                          <p className={styles.boardZoneEmpty}>Drop commander here</p>
                        )}
                      </div>
                    </div>
                  );
                }

                // List mode: freeform named columns
                if (useListCols) {
                  return (
                    <div
                      key={board.id}
                      data-board={board.id}
                      className={styles.boardZone}
                      onDragOver={(e) => {
                        if (!isOwner || !dragId) return;
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "move";
                      }}
                      onDrop={(e) => void onBoardTabDrop(e, board.id)}
                    >
                      <header className={styles.boardZoneHeader}>
                        <h2 className={styles.boardZoneTitle}>{board.label}</h2>
                        <span className={styles.boardZoneCount}>{board.count}</span>
                        {isOwner && (
                          <button
                            type="button"
                            className={styles.addColumnBtn}
                            onClick={() => addListColumn(board.id)}
                          >
                            + Column
                          </button>
                        )}
                      </header>
                                            <div className={styles.stacksRow}>
                        {layout.columns.map((col, colIdx) => {
                          const colCards = cardsForListColumn(
                            board.cards,
                            board.id,
                            col.id,
                            colIdx === 0
                          );
                          const colDrop =
                            dragId &&
                            dragOverId === `listcol:${board.id}:${col.id}`;
                          return (
                            <section
                              key={col.id}
                              className={`${styles.stackColumn}${
                                colDrop ? ` ${styles.stackColumnDropActive}` : ""
                              }`}
                              onDragOver={(e) => {
                                if (!isOwner || !dragId) return;
                                e.preventDefault();
                                e.dataTransfer.dropEffect = "move";
                                setDragOverId(`listcol:${board.id}:${col.id}`);
                              }}
                              onDragLeave={() => {
                                if (dragOverId === `listcol:${board.id}:${col.id}`) {
                                  setDragOverId(null);
                                }
                              }}
                              onDrop={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                const sourceId =
                                  dragId || e.dataTransfer.getData("text/plain");
                                setDragId(null);
                                setDragOverId(null);
                                if (!sourceId || !detail || !isOwner) return;
                                const source = detail.cards.find((c) => c.id === sourceId);
                                if (!source) return;
                                if (source.board !== board.id) {
                                  void moveCardToBoard(source, board.id).then(() => {
                                    placeCardInListColumn(board.id, sourceId, col.id);
                                  });
                                  return;
                                }
                                placeCardInListColumn(board.id, sourceId, col.id);
                              }}
                            >
                              <div className={styles.stackHeader}>
                                {isOwner ? (
                                  <input
                                    className={styles.columnNameInput}
                                    value={col.name}
                                    aria-label="Column name"
                                    onChange={(e) =>
                                      renameListColumn(board.id, col.id, e.target.value)
                                    }
                                  />
                                ) : (
                                  <h3 className={styles.stackTitle}>{col.name}</h3>
                                )}
                                <span className={styles.stackCount}>
                                  {colCards.reduce((n, c) => n + c.quantity, 0)}
                                </span>
                                {isOwner &&
                                  colCards.length === 0 &&
                                  layout.columns.length > 1 && (
                                    <button
                                      type="button"
                                      className={styles.removeColumnBtn}
                                      title="Remove empty column"
                                      aria-label={`Remove column ${col.name}`}
                                      onClick={() => removeListColumn(board.id, col.id)}
                                    >
                                      ×
                                    </button>
                                  )}
                              </div>
                              <div className={styles.stackCards}>
                                {colCards.map((c, cardIdx) => {
                                  const src = stackImageSrc(c);
                                  const dragging = dragId === c.id;
                                  const over = dragOverId === c.id;
                                  const multi = looksMultiFace(c);
                                  return (
                                    <div
                                      key={c.id}
                                      className={`${styles.stackCard}${
                                        dragging ? ` ${styles.stackCardDragging}` : ""
                                      }${over ? ` ${styles.stackCardDropTarget}` : ""}`}
                                      style={{ zIndex: cardIdx + 1 }}
                                      draggable={isOwner}
                                      onDragStart={(e) => onTileDragStart(e, c)}
                                      onDrag={() => onTileDrag()}
                                      onDragOver={(e) => onTileDragOver(e, c)}
                                      onDragLeave={() => onTileDragLeave(c)}
                                      onDrop={(e) => void onTileDrop(e, c)}
                                      onDragEnd={onTileDragEnd}
                                      onClick={() => openCardModal(c)}
                                    >
                                      <div
                                        className={styles.stackCardLink}
                                        title={c.name}
                                      >
                                        {src ? (
                                          <img
                                            src={src}
                                            alt={c.name}
                                            className={styles.stackCardImg}
                                            loading="lazy"
                                            draggable={false}
                                          />
                                        ) : (
                                          <div className={styles.stackCardPlaceholder}>
                                            {c.name}
                                          </div>
                                        )}
                                      </div>
                                      {c.quantity > 1 && (
                                        <span className={styles.stackQty}>
                                          ×{c.quantity}
                                        </span>
                                      )}
                                      {multi && (
                                        <button
                                          type="button"
                                          className={styles.stackFlipBtn}
                                          title="Flip card"
                                          aria-label={`Flip ${c.name}`}
                                          onClick={(e) => void toggleStackFace(c, e)}
                                        >
                                          Flip
                                        </button>
                                      )}
                                      {isOwner && (
                                        <div className={styles.stackCardControls}>
                                          <button
                                            type="button"
                                            className={styles.stackQtyBtn}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              void onQty(c, -1);
                                            }}
                                            aria-label={`Decrease ${c.name}`}
                                          >
                                            −
                                          </button>
                                          <button
                                            type="button"
                                            className={styles.stackQtyBtn}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              void onQty(c, 1);
                                            }}
                                            aria-label={`Increase ${c.name}`}
                                          >
                                            +
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </section>
                          );
                        })}
                        {isOwner && (
                          <div
                            className={`${styles.newColumnDrop}${
                              dragId &&
                              dragOverId === `listcol-new:${board.id}`
                                ? ` ${styles.newColumnDropActive}`
                                : ""
                            }${dragId ? ` ${styles.newColumnDropVisible}` : ""}`}
                            onDragOver={(e) => {
                              if (!dragId) return;
                              e.preventDefault();
                              e.dataTransfer.dropEffect = "copy";
                              setDragOverId(`listcol-new:${board.id}`);
                            }}
                            onDragLeave={() => {
                              if (dragOverId === `listcol-new:${board.id}`) {
                                setDragOverId(null);
                              }
                            }}
                            onDrop={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              const sourceId =
                                dragId || e.dataTransfer.getData("text/plain");
                              setDragId(null);
                              setDragOverId(null);
                              if (!sourceId || !detail || !isOwner) return;
                              const source = detail.cards.find((c) => c.id === sourceId);
                              if (!source) return;
                              if (source.board !== board.id) {
                                void moveCardToBoard(source, board.id).then(() => {
                                  createColumnAndPlace(board.id, sourceId);
                                });
                                return;
                              }
                              createColumnAndPlace(board.id, sourceId);
                            }}
                          >
                            <span className={styles.newColumnDropLabel}>
                              {dragId ? "Drop to create column" : "+"}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }

                // Type / Tags grouping — normal stacks
                return (
                  <div
                    key={board.id}
                    data-board={board.id}
                    className={styles.boardZone}
                    onDragOver={(e) => {
                      if (!isOwner || !dragId) return;
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                    }}
                    onDrop={(e) => void onBoardTabDrop(e, board.id)}
                  >
                    <header className={styles.boardZoneHeader}>
                      <h2 className={styles.boardZoneTitle}>{board.label}</h2>
                      <span className={styles.boardZoneCount}>{board.count}</span>
                    </header>
                    {board.cards.length === 0 ? (
                      <p className={styles.boardZoneEmpty}>Empty — drop cards here</p>
                    ) : (
                      <div className={styles.stacksRow}>
                        {board.groups.map((g) => {
                          const count = g.cards.reduce((n, c) => n + c.quantity, 0);
                          return (
                            <section
                              key={`${board.id}-${g.key}`}
                              className={styles.stackColumn}
                            >
                              <div className={styles.stackHeader}>
                                <h3 className={styles.stackTitle}>{g.label}</h3>
                                <span className={styles.stackCount}>{count}</span>
                              </div>
                              <div className={styles.stackCards}>
                                {g.cards.map((c, cardIdx) => {
                                  const src = stackImageSrc(c);
                                  const multi = looksMultiFace(c);
                                  const dragging = dragId === c.id;
                                  const over = dragOverId === c.id;
                                  return (
                                    <div
                                      key={c.id}
                                      className={`${styles.stackCard}${
                                        dragging ? ` ${styles.stackCardDragging}` : ""
                                      }${over ? ` ${styles.stackCardDropTarget}` : ""}`}
                                      style={{ zIndex: cardIdx + 1 }}
                                      draggable={isOwner}
                                      onDragStart={(e) => onTileDragStart(e, c)}
                                      onDrag={() => onTileDrag()}
                                      onDragOver={(e) => onTileDragOver(e, c)}
                                      onDragLeave={() => onTileDragLeave(c)}
                                      onDrop={(e) => void onTileDrop(e, c)}
                                      onDragEnd={onTileDragEnd}
                                      onClick={() => openCardModal(c)}
                                    >
                                      <div
                                        className={styles.stackCardLink}
                                        title={c.name}
                                      >
                                        {src ? (
                                          <img
                                            src={src}
                                            alt={c.name}
                                            className={styles.stackCardImg}
                                            loading="lazy"
                                            draggable={false}
                                          />
                                        ) : (
                                          <div className={styles.stackCardPlaceholder}>
                                            {c.name}
                                          </div>
                                        )}
                                      </div>
                                      {c.quantity > 1 && (
                                        <span className={styles.stackQty}>
                                          ×{c.quantity}
                                        </span>
                                      )}
                                      {multi && (
                                        <button
                                          type="button"
                                          className={styles.stackFlipBtn}
                                          title="Flip card"
                                          aria-label={`Flip ${c.name}`}
                                          onClick={(e) => void toggleStackFace(c, e)}
                                        >
                                          Flip
                                        </button>
                                      )}
                                      {isOwner && (
                                        <div className={styles.stackCardControls}>
                                          <button
                                            type="button"
                                            className={styles.stackQtyBtn}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              void onQty(c, -1);
                                            }}
                                            aria-label={`Decrease ${c.name}`}
                                          >
                                            −
                                          </button>
                                          <button
                                            type="button"
                                            className={styles.stackQtyBtn}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              void onQty(c, 1);
                                            }}
                                            aria-label={`Increase ${c.name}`}
                                          >
                                            +
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </section>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {panel === "deck" && viewMode === "text" && (
            <div className={styles.boardZones}>
              {boardSections.map((board) => (
                <section
                  key={board.id}
                  className={styles.boardZone}
                  onDragOver={(e) => {
                    if (!isOwner || !dragId) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                  }}
                  onDrop={(e) => void onBoardTabDrop(e, board.id)}
                >
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
                                <li key={c.id} className={styles.cardRow}>
                                  <div className={styles.cardMain}>
                                    <QtyControl
                                      quantity={c.quantity}
                                      disabled={!isOwner}
                                      onDelta={(d) => void onQty(c, d)}
                                      onCommit={(raw) => void onQtyCommit(c, raw)}
                                    />
                                    <button
                                      type="button"
                                      className={styles.cardName}
                                      onMouseEnter={(e) => onNameEnter(c, e)}
                                      onMouseMove={onNameMove}
                                      onMouseLeave={onNameLeave}
                                      onClick={() => openCardModal(c)}
                                    >
                                      {c.name}
                                    </button>
                                    <ManaCost cost={c.mana_cost} size={15} />
                                    <span className={styles.cardType}>{c.type_line}</span>
                                  </div>
                                  {isOwner && (
                                    <div className={styles.cardActions}>
                                      {(c.tag_ids ?? []).length > 0 && (
                                        <div className={styles.cardTagRow}>
                                          {(c.tag_ids ?? []).map((tid) => {
                                            const t = detail.tags.find((x) => x.id === tid);
                                            if (!t) return null;
                                            return (
                                              <button
                                                key={tid}
                                                type="button"
                                                className={`${styles.miniTag} ${styles.miniTagOn}`}
                                                title="Remove tag"
                                                onClick={() => void toggleTag(c, t)}
                                              >
                                                {t.name} ×
                                              </button>
                                            );
                                          })}
                                        </div>
                                      )}
                                      <CardTagPicker
                                        card={c}
                                        tags={detail.tags}
                                        open={tagMenuCardId === c.id}
                                        onOpenChange={(open) =>
                                          setTagMenuCardId(open ? c.id : null)
                                        }
                                        onToggle={(tag) => void toggleTag(c, tag)}
                                      />
                                      <select
                                        className={styles.boardSelect}
                                        value={c.board}
                                        aria-label={`Board for ${c.name}`}
                                        onChange={(e) =>
                                          void moveCardToBoard(
                                            c,
                                            e.target.value as DeckBoard
                                          )
                                        }
                                      >
                                        {BOARDS.map((b) => (
                                          <option key={b.id} value={b.id}>
                                            {b.label}
                                          </option>
                                        ))}
                                      </select>
                                      <button
                                        type="button"
                                        className={styles.removeBtn}
                                        onClick={() => void onRemove(c)}
                                      >
                                        Remove
                                      </button>
                                    </div>
                                  )}
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
              {detail.cards.length === 0 && (
                <p className={styles.empty}>
                  No cards yet. Use the search above to add some.
                </p>
              )}
            </div>
          )}
        </>
      )}

      {modalCard && (
        <DeckCardModal
          card={
            detail?.cards.find((c) => c.id === modalCard.id) ?? modalCard
          }
          imageUrl={imageUrls[modalCard.id]}
          isOwner={isOwner}
          onClose={() => setModalCard(null)}
          onQty={(d) => {
            const live = detail?.cards.find((c) => c.id === modalCard.id) ?? modalCard;
            void onQty(live, d);
          }}
          onBoard={(b) => {
            const live = detail?.cards.find((c) => c.id === modalCard.id) ?? modalCard;
            void moveCardToBoard(live, b);
          }}
          onRemove={() => {
            const live = detail?.cards.find((c) => c.id === modalCard.id) ?? modalCard;
            void onRemove(live);
          }}
        />
      )}

      <CardHoverPreview
        card={hoverCard}
        src={hoverSrc}
        x={hoverPos.x}
        y={hoverPos.y}
      />
    </div>
  );
}

function QtyControl({
  quantity,
  disabled,
  onDelta,
  onCommit,
}: {
  quantity: number;
  disabled?: boolean;
  onDelta: (delta: number) => void;
  onCommit: (raw: string) => void;
}) {
  const [draft, setDraft] = useState(String(quantity));

  useEffect(() => {
    setDraft(String(quantity));
  }, [quantity]);

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.currentTarget.blur();
      onCommit(draft);
    } else if (e.key === "Escape") {
      setDraft(String(quantity));
      e.currentTarget.blur();
    }
  }

  return (
    <div className={styles.qtyControl}>
      <button
        type="button"
        className={styles.qtyBtn}
        disabled={disabled}
        onClick={() => onDelta(-1)}
        aria-label="Decrease quantity"
      >
        −
      </button>
      <input
        className={styles.qtyInput}
        type="number"
        min={0}
        inputMode="numeric"
        disabled={disabled}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => onCommit(draft)}
        onKeyDown={onKey}
        aria-label="Quantity"
      />
      <button
        type="button"
        className={styles.qtyBtn}
        disabled={disabled}
        onClick={() => onDelta(1)}
        aria-label="Increase quantity"
      >
        +
      </button>
    </div>
  );
}

function CardTagPicker({
  card,
  tags,
  open,
  onOpenChange,
  onToggle,
}: {
  card: DeckCard;
  tags: DeckTag[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onToggle: (tag: DeckTag) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const assigned = new Set(card.tag_ids ?? []);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) onOpenChange(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onOpenChange(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onOpenChange]);

  if (tags.length === 0) {
    return (
      <span className={styles.hint} title="Create tags in the Tags panel">
        No tags
      </span>
    );
  }

  return (
    <div className={styles.tagPicker} ref={wrapRef}>
      <button
        type="button"
        className={styles.tagPickerBtn}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => onOpenChange(!open)}
      >
        Add tag
      </button>
      {open && (
        <ul className={styles.tagPickerMenu} role="listbox">
          {tags.map((t) => {
            const on = assigned.has(t.id);
            return (
              <li key={t.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={on}
                  className={
                    on
                      ? `${styles.tagPickerItem} ${styles.tagPickerItemOn}`
                      : styles.tagPickerItem
                  }
                  onClick={() => onToggle(t)}
                >
                  <span>{t.name}</span>
                  {on && <span aria-hidden>✓</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
