import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import {
  fetchDrawerCards,
  listDrawers,
  seedDefaultDrawers,
} from "../services/drawerService";
import type { Drawer, DrawerCardView } from "../types/drawer";
import { ManaCost } from "./ManaCost";
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
import styles from "./DrawerPanel.module.css";

type Props = {
  onAddCard: (card: DrawerCardView) => void;
};

export function DrawerPanel({ onAddCard }: Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [drawers, setDrawers] = useState<Drawer[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [cards, setCards] = useState<DrawerCardView[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingCards, setLoadingCards] = useState(false);
  const [viewMode, setViewMode] = useState<DrawerViewMode>(() => getDrawerViewMode());
  const [sortKey, setSortKey] = useState<CardSortKey>(() => {
    const k = getDrawerSortKey();
    return (CARD_SORT_OPTIONS.some((o) => o.id === k) ? k : "name") as CardSortKey;
  });
  const [filter, setFilter] = useState("");
  const [error, setError] = useState<string | null>(null);

  const loadList = useCallback(async () => {
    if (!user) return;
    setLoadingList(true);
    let { drawers: list, error: err } = await listDrawers(user.id);
    if (!err && list.length === 0) {
      const seeded = await seedDefaultDrawers(user.id);
      list = seeded.drawers;
      err = seeded.error;
    }
    if (err) setError(err);
    setDrawers(list);
    setActiveId((prev) => prev ?? list[0]?.id ?? null);
    setLoadingList(false);
  }, [user]);

  useEffect(() => {
    if (open) void loadList();
  }, [open, loadList]);

  useEffect(() => {
    if (!user || !activeId || !open) return;
    let cancelled = false;
    async function load() {
      setLoadingCards(true);
      const { cards: list, error: err } = await fetchDrawerCards(
        activeId!,
        user!.id
      );
      if (cancelled) return;
      if (err) setError(err);
      setCards(list);
      setLoadingCards(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [user, activeId, open]);

  if (!user) return null;

  const sortedCards = useMemo(
    () => sortCardsBy(cards, sortKey),
    [cards, sortKey]
  );

  const q = filter.trim().toLowerCase();
  const visible = useMemo(() => {
    if (!q) return sortedCards;
    return sortedCards.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.type_line.toLowerCase().includes(q)
    );
  }, [sortedCards, q]);

  function onViewMode(mode: DrawerViewMode) {
    setViewMode(mode);
    setDrawerViewMode(mode);
  }

  function onSortKeyChange(key: CardSortKey) {
    setSortKey(key);
    setDrawerSortKey(key);
  }

  return (
    <div className={styles.wrap}>
      <button
        type="button"
        className={`${styles.toggleBtn}${open ? ` ${styles.toggleBtnOpen}` : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        Drawers
      </button>

      {open && (
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <span className={styles.panelTitle}>Drawers</span>
            <Link to="/drawers" className={styles.manageLink} onClick={() => setOpen(false)}>
              Manage
            </Link>
            <button
              type="button"
              className={styles.closeBtn}
              onClick={() => setOpen(false)}
              aria-label="Close drawers"
            >
              ×
            </button>
          </div>

          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}

          <div className={styles.drawerTabs}>
            {loadingList && <span className={styles.muted}>Loading…</span>}
            {drawers.map((d) => (
              <button
                key={d.id}
                type="button"
                className={`${styles.tab}${d.id === activeId ? ` ${styles.tabActive}` : ""}`}
                onClick={() => setActiveId(d.id)}
              >
                {d.name}
                <span className={styles.tabCount}>{d.card_count ?? 0}</span>
              </button>
            ))}
          </div>

          <div className={styles.toolbar}>
            <input
              className={styles.filter}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter…"
            />
            <select
              className={styles.sortSelect}
              value={sortKey}
              onChange={(e) => onSortKeyChange(e.target.value as CardSortKey)}
              aria-label="Sort cards"
            >
              {CARD_SORT_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
            <div className={styles.viewToggle} role="group" aria-label="View mode">
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
                Img
              </button>
            </div>
          </div>

          <div className={styles.cardList}>
            {loadingCards && <p className={styles.muted}>Loading cards…</p>}
            {!loadingCards && visible.length === 0 && (
              <p className={styles.muted}>No cards in this drawer.</p>
            )}
            {visible.map((c) => (
              <div key={c.id} className={styles.cardRow}>
                {viewMode === "image" && (
                  <div className={styles.thumb}>
                    {c.image_url ? (
                      <img src={c.image_url} alt="" />
                    ) : (
                      <span />
                    )}
                  </div>
                )}
                <div className={styles.meta}>
                  <span className={styles.name}>{c.name}</span>
                  <span className={styles.type}>{c.type_line}</span>
                </div>
                {c.mana_cost && (
                  <span className={styles.mana}>
                    <ManaCost cost={c.mana_cost} size={12} />
                  </span>
                )}
                <button
                  type="button"
                  className={styles.addBtn}
                  onClick={() => onAddCard(c)}
                  title={`Add ${c.name}`}
                >
                  +
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
