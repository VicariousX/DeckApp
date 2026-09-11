import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { useArtPreferences } from "../auth/ArtPreferencesProvider";
import { ManaCost } from "../components/ManaCost";
import { fetchAutocomplete, fetchNamedCard } from "../lib/scryfallApi";
import { primaryTypeGroup, sortTypeGroups } from "../lib/cards/cardTypes";
import {
  getDeckViewMode,
  setDeckViewMode,
  setLastViewedDeck,
  type DeckViewMode,
} from "../lib/deckPreferences";
import { ensureUserCardFromScryfall } from "../services/userCardService";
import { useDeckCardHover } from "../hooks/useDeckCardHover";
import { CardHoverPreview } from "../components/CardHoverPreview";
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

const BOARDS: { id: DeckBoard; label: string }[] = [
  { id: "main", label: "Main" },
  { id: "side", label: "Side" },
  { id: "maybe", label: "Maybe" },
  { id: "commander", label: "Commander" },
];

function sortCards(cards: DeckCard[]): DeckCard[] {
  return [...cards].sort((a, b) => {
    const so = (a.sort_order ?? 0) - (b.sort_order ?? 0);
    if (so !== 0) return so;
    return a.name.localeCompare(b.name);
  });
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
  const [activeBoard, setActiveBoard] = useState<DeckBoard>("main");
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

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

  const boardCards = useMemo(() => {
    if (!detail) return [] as DeckCard[];
    return sortCards(detail.cards.filter((c) => c.board === activeBoard));
  }, [detail, activeBoard]);

  const groups = useMemo(() => {
    if (!detail) return [] as { key: string; label: string; cards: DeckCard[] }[];
    const cards = boardCards;
    if (groupMode === "none") {
      return [{ key: "all", label: "All cards", cards }];
    }
    if (groupMode === "type") {
      const map = new Map<string, DeckCard[]>();
      for (const c of cards) {
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
    for (const c of cards) {
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
    const sections = detail.tags
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
  }, [detail, groupMode, boardCards]);

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
      board: activeBoard,
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

  function onTileDragStart(e: DragEvent, card: DeckCard) {
    if (!isOwner) return;
    setDragId(card.id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", card.id);
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
    <div className={`${transitions.page} ${styles.page}`}>
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
                <span>
                  {activeBoard}: {boardCounts[activeBoard]}
                </span>
              </p>
              {detail.deck.description && (
                <p className={styles.desc}>{detail.deck.description}</p>
              )}
            </div>
          </header>

          <div className={styles.boardTabs} role="tablist" aria-label="Board">
            {BOARDS.map((b) => (
              <button
                key={b.id}
                type="button"
                role="tab"
                aria-selected={activeBoard === b.id}
                className={
                  activeBoard === b.id
                    ? `${styles.boardTab} ${styles.boardTabActive}`
                    : styles.boardTab
                }
                onClick={() => setActiveBoard(b.id)}
                onDragOver={(e) => {
                  if (!isOwner || !dragId) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                }}
                onDrop={(e) => void onBoardTabDrop(e, b.id)}
              >
                {b.label}
                <span className={styles.boardTabCount}>
                  {boardCounts[b.id]}
                </span>
              </button>
            ))}
          </div>

          {isOwner && (
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

          {isOwner && (
            <section className={styles.tagsPanel}>
              <h2 className={styles.sectionLabel}>Deck tags</h2>
              <form className={styles.tagForm} onSubmit={onCreateTag}>
                <input
                  className={styles.input}
                  placeholder="New tag name"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  maxLength={40}
                />
                <button type="submit" className={styles.secondaryBtn}>
                  Add tag
                </button>
              </form>
              <div className={styles.tagChips}>
                {detail.tags.map((t) => (
                  <span key={t.id} className={styles.tagChip}>
                    {t.name}
                    <button
                      type="button"
                      className={styles.tagRemove}
                      onClick={() => void onDeleteTag(t)}
                      aria-label={`Delete ${t.name}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
                {detail.tags.length === 0 && (
                  <span className={styles.hint}>
                    Tags are deck-specific. Create one, then assign it on cards.
                  </span>
                )}
              </div>
            </section>
          )}

          <div className={styles.groups}>
            {groups.map((g) => {
              const count = g.cards.reduce((n, c) => n + c.quantity, 0);
              return (
                <section key={g.key} className={styles.group}>
                  <h3 className={styles.groupTitle}>
                    {g.label}
                    <span className={styles.groupCount}>{count}</span>
                  </h3>

                  {viewMode === "image" ? (
                    <div className={styles.imageGrid}>
                      {g.cards.map((c) => {
                        const src = imageUrls[c.id];
                        const dragging = dragId === c.id;
                        const over = dragOverId === c.id;
                        return (
                          <div
                            key={c.id}
                            className={`${styles.imageTile} ${
                              dragging ? styles.imageTileDragging : ""
                            } ${over ? styles.imageTileDropTarget : ""}`}
                            draggable={isOwner}
                            onDragStart={(e) => onTileDragStart(e, c)}
                            onDragOver={(e) => onTileDragOver(e, c)}
                            onDragLeave={() => onTileDragLeave(c)}
                            onDrop={(e) => void onTileDrop(e, c)}
                            onDragEnd={onTileDragEnd}
                          >
                            <Link
                              to={`/card/${c.scryfall_id}`}
                              className={styles.imageTileLink}
                              title={c.name}
                              draggable={false}
                              onClick={(e) => {
                                // Avoid navigating while ending a drag
                                if (dragId) e.preventDefault();
                              }}
                            >
                              {src ? (
                                <img
                                  src={src}
                                  alt={c.name}
                                  className={styles.imageTileImg}
                                  loading="lazy"
                                  draggable={false}
                                />
                              ) : (
                                <div className={styles.imageTilePlaceholder}>
                                  {c.name}
                                </div>
                              )}
                              {c.quantity > 1 && (
                                <span className={styles.imageQty}>
                                  ×{c.quantity}
                                </span>
                              )}
                            </Link>
                            {isOwner && (
                              <div className={styles.imageTileControls}>
                                <button
                                  type="button"
                                  className={styles.imageQtyBtn}
                                  onClick={() => void onQty(c, -1)}
                                  aria-label={`Decrease ${c.name}`}
                                >
                                  −
                                </button>
                                <button
                                  type="button"
                                  className={styles.imageQtyBtn}
                                  onClick={() => void onQty(c, 1)}
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
                  ) : (
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
                            <Link
                              to={`/card/${c.scryfall_id}`}
                              className={styles.cardName}
                              onMouseEnter={(e) => onNameEnter(c, e)}
                              onMouseMove={onNameMove}
                              onMouseLeave={onNameLeave}
                            >
                              {c.name}
                            </Link>
                            <ManaCost cost={c.mana_cost} size={15} />
                            <span className={styles.cardType}>
                              {c.type_line}
                            </span>
                          </div>
                          {isOwner && (
                            <div className={styles.cardActions}>
                              {detail.tags.length > 0 && (
                                <div className={styles.cardTagRow}>
                                  {detail.tags.map((t) => {
                                    const on = (c.tag_ids ?? []).includes(t.id);
                                    return (
                                      <button
                                        key={t.id}
                                        type="button"
                                        className={
                                          on
                                            ? `${styles.miniTag} ${styles.miniTagOn}`
                                            : styles.miniTag
                                        }
                                        onClick={() => void toggleTag(c, t)}
                                      >
                                        {t.name}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
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
                  )}
                </section>
              );
            })}
            {boardCards.length === 0 && (
              <p className={styles.empty}>
                {detail.cards.length === 0
                  ? "No cards yet. Use the search above to add some."
                  : `No cards on the ${activeBoard} board.`}
              </p>
            )}
          </div>
        </>
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
