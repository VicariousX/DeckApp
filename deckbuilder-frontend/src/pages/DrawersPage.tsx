import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import {
  createDrawer,
  deleteDrawer,
  fetchDrawerCards,
  listDrawers,
  removeOracleFromDrawer,
  renameDrawer,
  seedDefaultDrawers,
} from "../services/drawerService";
import type { Drawer, DrawerCardView } from "../types/drawer";
import { ManaCost } from "../components/ManaCost";
import {
  CARD_SORT_OPTIONS,
  sortCardsBy,
  type CardSortKey,
} from "../lib/cards/cardSort";
import {
  getDrawerSortKey,
  getDrawerViewMode,
  setDrawerSortKey,
  setDrawerViewMode,
  type DrawerViewMode,
} from "../lib/deckPreferences";
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
  const [sortKey, setSortKey] = useState<CardSortKey>(() => {
    const k = getDrawerSortKey();
    return (CARD_SORT_OPTIONS.some((o) => o.id === k) ? k : "name") as CardSortKey;
  });

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
    if (!confirm("Delete this drawer? Cards are only removed from the drawer.")) {
      return;
    }
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
    setDrawers((prev) =>
      prev.map((d) =>
        d.id === selectedId
          ? { ...d, card_count: Math.max(0, (d.card_count ?? 1) - 1) }
          : d
      )
    );
  }

  const sortedCards = useMemo(
    () => sortCardsBy(cards, sortKey),
    [cards, sortKey]
  );

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

  return (
    <div className={`${transitions.page} ${styles.page}`}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Drawers</h1>
          <p className={styles.subtitle}>
            Saved card groups you can pull into any deck.
          </p>
        </div>
        <div className={styles.headerTools}>
          <label className={styles.sortLabel}>
            Sort
            <select
              className={styles.sortSelect}
              value={sortKey}
              onChange={(e) => onSortKey(e.target.value as CardSortKey)}
            >
              {CARD_SORT_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
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
        </div>
      </header>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <div className={styles.layout}>
        <aside className={styles.sidebar}>
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
                  <span className={styles.drawerCount}>{d.card_count ?? 0}</span>
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
                        onClick={() => void onDelete(selected.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </>
                )}
              </div>

              {cardsLoading && <p className={styles.muted}>Loading cards…</p>}
              {!cardsLoading && sortedCards.length === 0 && (
                <p className={styles.muted}>
                  This drawer is empty. Add cards from search, a card page, or the
                  deck builder.
                </p>
              )}

              {!cardsLoading && sortedCards.length > 0 && (
                <ul
                  className={
                    viewMode === "image" ? styles.cardGrid : styles.cardList
                  }
                >
                  {sortedCards.map((c) => (
                    <li key={c.id} className={styles.cardRow}>
                      {viewMode === "image" && (
                        <div className={styles.thumb}>
                          {c.image_url ? (
                            <img src={c.image_url} alt={c.name} />
                          ) : (
                            <span className={styles.thumbFallback}>{c.name}</span>
                          )}
                        </div>
                      )}
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
    </div>
  );
}
