import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { fetchAutocomplete, fetchCardById, fetchNamedCard } from "../lib/scryfallApi";
import { primaryTypeGroup, sortTypeGroups } from "../lib/cards/cardTypes";
import {
  applyUserCardArt,
  mapScryfallToDeckApp,
} from "../lib/cards/mapScryfallToDeckApp";
import { getCardArtPublicBase } from "../services/cardArtService";
import { useUserCardArt } from "../hooks/useUserCardArt";
import {
  addCardToDeck,
  createDeckTag,
  deleteDeckTag,
  fetchDeckDetail,
  removeCardFromDeck,
  setCardQuantity,
  setCardTag,
} from "../services/deckService";
import type { DeckCard, DeckDetail, DeckTag } from "../types/deck";
import transitions from "../styles/pageTransitions.module.css";
import styles from "./DeckBuilderPage.module.css";

type GroupMode = "type" | "tag" | "none";

function sortCards(cards: DeckCard[]): DeckCard[] {
  return [...cards].sort((a, b) => a.name.localeCompare(b.name));
}

export function DeckBuilderPage() {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const { artByOracleId } = useUserCardArt();

  const [detail, setDetail] = useState<DeckDetail | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [groupMode, setGroupMode] = useState<GroupMode>("type");

  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [addBusy, setAddBusy] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const [newTagName, setNewTagName] = useState("");

  // Hover preview
  const [hoverCard, setHoverCard] = useState<DeckCard | null>(null);
  const [hoverSrc, setHoverSrc] = useState<string | null>(null);
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 });
  const hoverCache = useRef<Map<string, string>>(new Map());
  const hoverLeaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    function onDoc(e: MouseEvent) {
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

  // Resolve hover art (preferred / custom when available)
  useEffect(() => {
    if (!hoverCard) {
      setHoverSrc(null);
      return;
    }
    const cacheKey = hoverCard.scryfall_id;
    const cached = hoverCache.current.get(cacheKey);
    if (cached) {
      setHoverSrc(cached);
      return;
    }
    let cancelled = false;
    async function resolve() {
      const { card } = await fetchCardById(hoverCard!.scryfall_id);
      if (cancelled || !card) return;
      const base = mapScryfallToDeckApp(card);
      const art = artByOracleId.get(base.oracle_id);
      const resolved = applyUserCardArt(base, art, {
        publicStorageBase: getCardArtPublicBase(),
      });
      const url =
        resolved.faces[0]?.image_url ||
        card.image_uris?.normal ||
        card.card_faces?.[0]?.image_uris?.normal ||
        "";
      if (url) {
        hoverCache.current.set(cacheKey, url);
        if (!cancelled) setHoverSrc(url);
      }
    }
    void resolve();
    return () => {
      cancelled = true;
    };
  }, [hoverCard, artByOracleId]);

  const isOwner = Boolean(user && detail && detail.deck.user_id === user.id);

  const totalCards = useMemo(
    () => (detail?.cards ?? []).reduce((n, c) => n + c.quantity, 0),
    [detail]
  );

  const groups = useMemo(() => {
    if (!detail) return [] as { key: string; label: string; cards: DeckCard[] }[];
    const cards = detail.cards;
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
        cards: map.get(k) ?? [],
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
        cards: byTag.get(t.id) ?? [],
      }));
    if (untagged.length) {
      sections.push({ key: "untagged", label: "Untagged", cards: untagged });
    }
    return sections;
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
      board: "main",
    });
    setAddBusy(false);
    if (addErr || !saved) {
      setError(addErr ?? "Could not add card.");
      return;
    }
    setQuery("");
    setSuggestOpen(false);
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

  function onNameEnter(card: DeckCard, e: MouseEvent) {
    if (hoverLeaveTimer.current) clearTimeout(hoverLeaveTimer.current);
    setHoverCard(card);
    setHoverPos({ x: e.clientX, y: e.clientY });
  }

  function onNameMove(e: MouseEvent) {
    setHoverPos({ x: e.clientX, y: e.clientY });
  }

  function onNameLeave() {
    hoverLeaveTimer.current = setTimeout(() => {
      setHoverCard(null);
      setHoverSrc(null);
    }, 80);
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
              </p>
              {detail.deck.description && (
                <p className={styles.desc}>{detail.deck.description}</p>
              )}
            </div>
          </header>

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
                          <span className={styles.cardType}>{c.type_line}</span>
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
                </section>
              );
            })}
            {detail.cards.length === 0 && (
              <p className={styles.empty}>
                No cards yet. Use the search above to add some.
              </p>
            )}
          </div>
        </>
      )}

      {hoverCard && hoverSrc && (
        <div
          className={styles.hoverPreview}
          style={{
            left: Math.min(hoverPos.x + 16, window.innerWidth - 200),
            top: Math.min(hoverPos.y + 12, window.innerHeight - 300),
          }}
        >
          <img src={hoverSrc} alt={hoverCard.name} />
        </div>
      )}
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
