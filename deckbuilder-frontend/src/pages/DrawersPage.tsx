import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import {
  addOracleToDrawer,
  createDrawer,
  deleteDrawer,
  fetchDrawerCards,
  listDrawers,
  removeOracleFromDrawer,
  renameDrawer,
  seedDefaultDrawers,
  setDrawerCardTier,
} from "../services/drawerService";
import type { Drawer, DrawerCardView } from "../types/drawer";
import { ManaCost } from "../components/ManaCost";
import { fetchAutocomplete, fetchNamedCard } from "../lib/scryfallApi";
import { ensureUserCardFromScryfall } from "../services/userCardService";
import { BulkCardImport, type BulkResolvedEntry } from "../components/BulkCardImport";
import { TextExportMenu } from "../components/TextExportMenu";
import { ConfirmDialog } from "../components/ConfirmDialog";
import {
  CARD_SORT_OPTIONS,
  sortCardsBy,
  type CardSortKey,
} from "../lib/cards/cardSort";
import {
  getDrawerShowTiers,
  getDrawerSortKey,
  getDrawerViewMode,
  setDrawerShowTiers,
  setDrawerSortKey,
  setDrawerViewMode,
  type DrawerViewMode,
} from "../lib/deckPreferences";
import { CardInspectorModal } from "../components/CardInspectorModal";
import { DrawerCardTile, DrawerTileField } from "../components/DrawerCardTile";
import transitions from "../styles/pageTransitions.module.css";
import styles from "./DrawersPage.module.css";

export function DrawersPage() {
  const { user, loading: authLoading } = useAuth();
  const [drawers, setDrawers] = useState<Drawer[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [cards, setCards] = useState<DrawerCardView[]>([]);
  const [loading, setLoading] = useState(true);
  const [cardsLoading, setCardsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [viewMode, setViewMode] = useState<DrawerViewMode>(() => getDrawerViewMode());
  const [showTiers, setShowTiers] = useState(() => getDrawerShowTiers());
  const [inspectId, setInspectId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<CardSortKey>(() => {
    const k = getDrawerSortKey();
    return (CARD_SORT_OPTIONS.some((o) => o.id === k) ? k : "name") as CardSortKey;
  });
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [addBusy, setAddBusy] = useState(false);
  const [lightbox, setLightbox] = useState<{ src: string; name: string } | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterUseful, setFilterUseful] = useState<string[]>([]);
  const [filterMaxTier, setFilterMaxTier] = useState<number | "">("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [deleteTarget, setDeleteTarget] = useState<Drawer | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadDrawers = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    let { drawers: list, error: err } = await listDrawers(user.id);
    if (!err && list.length === 0) {
      const seeded = await seedDefaultDrawers(user.id);
      list = seeded.drawers;
      err = seeded.error;
    }
    if (err) setError(err);
    setDrawers(list);
    setSelectedId((prev) => prev ?? list[0]?.id ?? null);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void loadDrawers();
  }, [loadDrawers]);

  useEffect(() => {
    if (!user || !selectedId) {
      setCards([]);
      return;
    }
    let cancelled = false;
    async function load() {
      setCardsLoading(true);
      const { cards: list, error: err } = await fetchDrawerCards(
        selectedId!,
        user!.id
      );
      if (cancelled) return;
      if (err) setError(err);
      setCards(list);
      setCardsLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [user, selectedId]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!user || !newName.trim()) return;
    const { drawer, error: err } = await createDrawer(user.id, newName);
    if (err || !drawer) {
      setError(err ?? "Could not create drawer.");
      return;
    }
    setNewName("");
    setDrawers((prev) => [...prev, { ...drawer, card_count: 0 }]);
    setSelectedId(drawer.id);
  }

  async function onRename(drawerId: string) {
    const { error: err } = await renameDrawer(drawerId, renameValue);
    if (err) {
      setError(err);
      return;
    }
    setDrawers((prev) =>
      prev.map((d) => (d.id === drawerId ? { ...d, name: renameValue.trim() } : d))
    );
    setRenamingId(null);
  }

  async function onDelete(drawerId: string) {
    const { error: err } = await deleteDrawer(drawerId);
    if (err) {
      setError(err);
      return;
    }
    setDrawers((prev) => prev.filter((d) => d.id !== drawerId));
    if (selectedId === drawerId) {
      setSelectedId(null);
      setCards([]);
    }
  }

  async function onRemoveCard(oracleId: string) {
    if (!selectedId) return;
    const { error: err } = await removeOracleFromDrawer(selectedId, oracleId);
    if (err) {
      setError(err);
      return;
    }
    setCards((prev) => prev.filter((c) => c.oracle_id !== oracleId));
    setInspectId((id) => {
      const cur = cards.find((c) => c.id === id);
      return cur && cur.oracle_id === oracleId ? null : id;
    });
    setDrawers((prev) =>
      prev.map((d) =>
        d.id === selectedId
          ? { ...d, card_count: Math.max(0, (d.card_count ?? 1) - 1) }
          : d
      )
    );
  }


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

  useEffect(() => {
    setQuery("");
    setSuggestions([]);
    setSuggestOpen(false);
  }, [selectedId]);

  async function addByName(name: string) {
    if (!user || !selectedId || !name.trim()) return;
    setAddBusy(true);
    setError(null);
    const { card, error: fetchErr } = await fetchNamedCard(name.trim());
    if (fetchErr || !card) {
      setError(fetchErr ?? "Card not found.");
      setAddBusy(false);
      return;
    }
    const { card: uc, error: uErr } = await ensureUserCardFromScryfall(user.id, card);
    if (uErr || !uc) {
      setError(uErr ?? "Could not save card.");
      setAddBusy(false);
      return;
    }
    const { error: aErr } = await addOracleToDrawer(selectedId, uc.oracle_id);
    setAddBusy(false);
    if (aErr) {
      setError(aErr);
      return;
    }
    setQuery("");
    setSuggestOpen(false);
    const { cards: list, error: cErr } = await fetchDrawerCards(selectedId, user.id);
    if (cErr) setError(cErr);
    setCards(list);
    setDrawers((prev) =>
      prev.map((d) =>
        d.id === selectedId ? { ...d, card_count: list.length } : d
      )
    );
  }


  async function onBulkImport(entries: BulkResolvedEntry[]) {
    if (!user || !selectedId) return;
    setError(null);
    let added = 0;
    for (const e of entries) {
      const { card: uc, error: uErr } = await ensureUserCardFromScryfall(
        user.id,
        e.card
      );
      if (uErr || !uc) continue;
      const { error: aErr } = await addOracleToDrawer(selectedId, uc.oracle_id);
      if (!aErr) added += 1;
    }
    const { cards: list, error: cErr } = await fetchDrawerCards(
      selectedId,
      user.id
    );
    if (cErr) setError(cErr);
    setCards(list);
    setDrawers((prev) =>
      prev.map((d) =>
        d.id === selectedId ? { ...d, card_count: list.length } : d
      )
    );
    if (added === 0 && entries.length > 0) {
      setError("Could not add cards to drawer.");
    }
  }

  async function onTier(cardId: string, next: number) {
    const tier = Math.max(1, Math.floor(next) || 1);
    setCards((prev) =>
      prev.map((c) => (c.id === cardId ? { ...c, tier } : c))
    );
    const { error: err } = await setDrawerCardTier(cardId, tier);
    if (err) setError(err);
  }

  const filteredCards = useMemo(() => {
    return cards.filter((c) => {
      if (filterMaxTier !== "" && (c.tier ?? 1) > filterMaxTier) return false;
      if (filterUseful.length > 0) {
        const have = new Set(
          (c.useful_in ?? []).map((t) =>
            t.length === 1 ? t.toUpperCase() : t.toLowerCase()
          )
        );
        if (!filterUseful.every((t) => have.has(t))) return false;
      }
      return true;
    });
  }, [cards, filterUseful, filterMaxTier]);

  const sortedCards = useMemo(() => {
    const list = sortCardsBy(filteredCards, sortKey);
    return sortDir === "desc" ? [...list].reverse() : list;
  }, [filteredCards, sortKey, sortDir]);

  function onViewMode(mode: DrawerViewMode) {
    setViewMode(mode);
    setDrawerViewMode(mode);
  }

  function onSortKey(key: CardSortKey) {
    setSortKey(key);
    setDrawerSortKey(key);
  }

  if (!authLoading && !user) {
    return <Navigate to="/login" replace />;
  }

  const selected = drawers.find((d) => d.id === selectedId) ?? null;
  const inspectNav = sortedCards.filter((c) => c.scryfall_id);
  const inspectIndex = inspectNav.findIndex((c) => c.id === inspectId);
  const inspectCard =
    inspectIndex >= 0
      ? inspectNav[inspectIndex]
      : sortedCards.find((c) => c.id === inspectId) ?? null;

  return (
    <div className={`${transitions.page} ${styles.page}`}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Drawers</h1>
          <p className={styles.subtitle}>
            Saved groups you can pull into any deck.
          </p>
        </div>
        <div className={styles.headerTools}>
          <div className={styles.viewToggle} role="group" aria-label="Drawer view mode">
            <button
              type="button"
              className={`${styles.viewBtn}${viewMode === "text" ? ` ${styles.viewBtnActive}` : ""}`}
              onClick={() => onViewMode("text")}
              aria-pressed={viewMode === "text"}
            >
              Text
            </button>
            <button
              type="button"
              className={`${styles.viewBtn}${viewMode === "image" ? ` ${styles.viewBtnActive}` : ""}`}
              onClick={() => onViewMode("image")}
              aria-pressed={viewMode === "image"}
            >
              Images
            </button>
          </div>
          {viewMode === "image" && (
            <button
              type="button"
              className={`${styles.viewBtn}${showTiers ? ` ${styles.viewBtnActive}` : ""}`}
              aria-pressed={showTiers}
              onClick={() => {
                setShowTiers((v) => {
                  setDrawerShowTiers(!v);
                  return !v;
                });
              }}
            >
              Tiers
            </button>
          )}
        </div>
      </header>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <div className={styles.layout}>
        <aside className={styles.sidebar}>
          <div className={styles.sidebarHead}>Your drawers</div>
          <form className={styles.createForm} onSubmit={(e) => void onCreate(e)}>
            <input
              className={styles.input}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="New drawer name…"
              maxLength={60}
            />
            <button type="submit" className={styles.primaryBtn} disabled={!newName.trim()}>
              Create
            </button>
          </form>

          {loading && <p className={styles.muted}>Loading…</p>}

          <ul className={styles.drawerList}>
            {drawers.map((d) => (
              <li key={d.id}>
                <button
                  type="button"
                  className={`${styles.drawerItem}${
                    d.id === selectedId ? ` ${styles.drawerItemActive}` : ""
                  }`}
                  onClick={() => setSelectedId(d.id)}
                >
                  <span className={styles.drawerName}>{d.name}</span>
                  <span className={styles.drawerCountMeta}>
                    <span className={styles.countLabel}>Cards</span>
                    <span className={styles.drawerCount}>{d.card_count ?? 0}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <section className={styles.main}>
          {!selected && !loading && (
            <p className={styles.muted}>Select or create a drawer.</p>
          )}
          {selected && (
            <>
              <div className={styles.mainHeader}>
                {renamingId === selected.id ? (
                  <form
                    className={styles.renameForm}
                    onSubmit={(e) => {
                      e.preventDefault();
                      void onRename(selected.id);
                    }}
                  >
                    <input
                      className={styles.input}
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      autoFocus
                    />
                    <button type="submit" className={styles.primaryBtn}>
                      Save
                    </button>
                    <button
                      type="button"
                      className={styles.ghostBtn}
                      onClick={() => setRenamingId(null)}
                    >
                      Cancel
                    </button>
                  </form>
                ) : (
                  <>
                    <h2 className={styles.drawerTitle}>{selected.name}</h2>
                    <div className={styles.mainActions}>
                      <button
                        type="button"
                        className={styles.ghostBtn}
                        onClick={() => {
                          setRenamingId(selected.id);
                          setRenameValue(selected.name);
                        }}
                      >
                        Rename
                      </button>
                      <button
                        type="button"
                        className={styles.dangerBtn}
                        onClick={() => setDeleteTarget(selected)}
                      >
                        Delete
                      </button>
                    </div>
                  </>
                )}
              </div>


              <div className={styles.addSection}>
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
                      onFocus={() => {
                        if (suggestions.length > 0) setSuggestOpen(true);
                      }}
                      placeholder="Quick add card…"
                      autoComplete="off"
                      disabled={addBusy}
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
                <div className={styles.toolRow}>
                  <BulkCardImport
                    title="Bulk Import"
                    respectQuantity={false}
                    existingOracleIds={cards.map((c) => c.oracle_id)}
                    triggerClassName={styles.toolBtn}
                    onImport={onBulkImport}
                  />
                  {selected && (
                    <TextExportMenu
                      label="Export"
                      triggerClassName={styles.toolBtn}
                      fileBaseName={selected.name}
                      sections={[
                        {
                          title: selected.name,
                          items: sortedCards.map((c) => ({
                            name: c.name,
                            quantity: 1,
                          })),
                        },
                      ]}
                      allSections={[
                        {
                          title: selected.name,
                          items: cards.map((c) => ({
                            name: c.name,
                            quantity: 1,
                          })),
                        },
                      ]}
                      options={{ includeHeaders: false }}
                    />
                  )}
                  <button
                    type="button"
                    className={`${styles.toolBtn}${filterOpen ? ` ${styles.toolBtnOn}` : ""}`}
                    onClick={() => setFilterOpen((v) => !v)}
                    aria-expanded={filterOpen}
                  >
                    {filterOpen ? "Close Filter" : "Filter"}
                  </button>
                  <label className={styles.sortLabel}>
                    Sort
                    <select
                      className={styles.toolSelect}
                      value={sortKey}
                      onChange={(e) => onSortKey(e.target.value as CardSortKey)}
                    >
                      {CARD_SORT_OPTIONS.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className={`${styles.toolBtn} ${styles.sortDirBtn}`}
                      onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
                      title={sortDir === "asc" ? "Ascending" : "Descending"}
                      aria-label="Reverse sort order"
                    >
                      {sortDir === "asc" ? "·" : "∴"}
                    </button>
                  </label>
                </div>
                {filterOpen && (
                  <div className={styles.filterPanel}>
                    <div className={`${styles.tierControl} ${styles.filterTier}`} title="Show cards at this tier or better">
                      <span className={styles.tierLabel}>Tier ≤</span>
                      <div className={styles.tierRow}>
                        <button
                          type="button"
                          className={styles.tierBtn}
                          disabled={filterMaxTier === ""}
                          onClick={() =>
                            setFilterMaxTier((v) =>
                              v === "" || v <= 1 ? "" : v - 1
                            )
                          }
                        >
                          −
                        </button>
                        <input
                          className={styles.tierInput}
                          type="text"
                          inputMode="numeric"
                          value={filterMaxTier === "" ? "Any" : filterMaxTier}
                          onChange={(e) => {
                            const raw = e.target.value.trim();
                            if (raw === "" || raw.toLowerCase() === "any") {
                              setFilterMaxTier("");
                              return;
                            }
                            const n = parseInt(raw, 10);
                            setFilterMaxTier(Number.isFinite(n) && n >= 1 ? n : "");
                          }}
                        />
                        <button
                          type="button"
                          className={styles.tierBtn}
                          onClick={() =>
                            setFilterMaxTier((v) => (v === "" ? 1 : v + 1))
                          }
                        >
                          +
                        </button>
                      </div>
                    </div>
                    <div className={styles.filterChips}>
                      {["W", "U", "B", "R", "G", "colorless", "colored", "mono", "multi", "wubrg"].map(
                        (tag) => {
                          const on = filterUseful.includes(tag);
                          return (
                            <button
                              key={tag}
                              type="button"
                              className={`${styles.filterChip}${on ? ` ${styles.filterChipOn}` : ""}`}
                              onClick={() =>
                                setFilterUseful((prev) =>
                                  on ? prev.filter((t) => t !== tag) : [...prev, tag]
                                )
                              }
                            >
                              {tag}
                            </button>
                          );
                        }
                      )}
                    </div>
                    {(filterUseful.length > 0 || filterMaxTier !== "") && (
                      <button
                        type="button"
                        className={styles.ghostBtn}
                        onClick={() => {
                          setFilterUseful([]);
                          setFilterMaxTier("");
                        }}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                )}
              </div>

              {cardsLoading && <p className={styles.muted}>Loading cards…</p>}
              {!cardsLoading && sortedCards.length === 0 && (
                <p className={styles.muted}>
                  This drawer is empty. Add cards from search, a card page, or the
                  deck builder.
                </p>
              )}

              {!cardsLoading && sortedCards.length > 0 && viewMode === "image" && (
                <DrawerTileField>
                <div className={styles.tileGrid}>
                  {sortedCards.map((c) => (
                    <DrawerCardTile
                      key={c.id}
                      card={c}
                      showTierMark={showTiers}
                      onOpen={() => {
                        if (c.scryfall_id) setInspectId(c.id);
                      }}
                      onRemove={() => void onRemoveCard(c.oracle_id)}
                      onTier={(n) => void onTier(c.id, n)}
                    />
                  ))}
                </div>
                </DrawerTileField>
              )}

              {!cardsLoading && sortedCards.length > 0 && viewMode === "text" && (
                <ul className={styles.cardList}>
                  {sortedCards.map((c) => (
                    <li key={c.id} className={styles.cardRow}>
                      <div className={styles.cardMeta}>
                        {c.scryfall_id ? (
                          <Link to={`/card/${c.scryfall_id}`} className={styles.cardName}>
                            {c.name}
                          </Link>
                        ) : (
                          <span className={styles.cardName}>{c.name}</span>
                        )}
                        <span className={styles.cardType}>{c.type_line}</span>
                      </div>
                      {c.mana_cost && (
                        <span className={styles.mana}>
                          <ManaCost cost={c.mana_cost} size={14} />
                        </span>
                      )}
                      <div className={styles.tierControl} title="Tier (1 = highest)">
                        <span className={styles.tierLabel}>Tier</span>
                        <div className={styles.tierRow}>
                        <button
                          type="button"
                          className={styles.tierBtn}
                          disabled={(c.tier ?? 1) <= 1}
                          onClick={() => void onTier(c.id, (c.tier ?? 1) - 1)}
                        >
                          −
                        </button>
                        <input
                          className={styles.tierInput}
                          type="number"
                          min={1}
                          value={c.tier ?? 1}
                          onChange={(e) => {
                            const n = parseInt(e.target.value, 10);
                            if (Number.isFinite(n)) void onTier(c.id, n);
                          }}
                        />
                        <button
                          type="button"
                          className={styles.tierBtn}
                          onClick={() => void onTier(c.id, (c.tier ?? 1) + 1)}
                        >
                          +
                        </button>
                        </div>
                      </div>
                      <button
                        type="button"
                        className={styles.removeBtn}
                        onClick={() => void onRemoveCard(c.oracle_id)}
                        aria-label={`Remove ${c.name}`}
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </section>
      </div>
      {inspectCard && inspectCard.scryfall_id && (
        <CardInspectorModal
          scryfallId={inspectCard.scryfall_id}
          name={inspectCard.name}
          imageUrl={inspectCard.image_url ?? undefined}
          onClose={() => setInspectId(null)}
          hasPrev={inspectIndex > 0}
          hasNext={inspectIndex >= 0 && inspectIndex < inspectNav.length - 1}
          onPrev={() => {
            if (inspectIndex > 0) setInspectId(inspectNav[inspectIndex - 1].id);
          }}
          onNext={() => {
            if (inspectIndex >= 0 && inspectIndex < inspectNav.length - 1) {
              setInspectId(inspectNav[inspectIndex + 1].id);
            }
          }}
        />
      )}
      {deleteTarget && (
        <ConfirmDialog
          title={`Delete ${deleteTarget.name}?`}
          message="Cards stay in your collection. They are only removed from this drawer."
          confirmLabel="Delete Drawer"
          cancelLabel="Cancel"
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => {
            const id = deleteTarget.id;
            setDeleteTarget(null);
            void onDelete(id);
          }}
        />
      )}
      {lightbox &&
        createPortal(
          <div
            className={styles.lightbox}
            role="dialog"
            aria-label={lightbox.name}
            onClick={() => setLightbox(null)}
          >
            <img src={lightbox.src} alt={lightbox.name} />
          </div>,
          document.body
        )}
    </div>
  );
}
