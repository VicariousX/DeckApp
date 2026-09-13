import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
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
  fitsColorIdentity,
  normalizeColorIdentity,
  sortCardsBy,
  type CardSortKey,
} from "../lib/cards/cardSort";
import { isUsefulInDeck } from "../lib/cards/usefulIn";
import {
  getDrawerSortKey,
  getDrawerViewMode,
  setDrawerSortKey,
  setDrawerViewMode,
  type DrawerViewMode,
} from "../lib/deckPreferences";
import styles from "./DrawerPanel.module.css";

export type IdentityFilter =
  | "all"
  | "mono"
  | "multi"
  | "colorless"
  | "W"
  | "U"
  | "B"
  | "R"
  | "G";

type Props = {
  onAddCard: (card: DrawerCardView) => void;
  /** Adjust quantity in deck by delta (-1 or +1). */
  onAdjustCard?: (card: DrawerCardView, delta: number) => void;
  onApplyDrawer?: (cards: DrawerCardView[]) => Promise<void> | void;
  commanderColorIdentity?: string[];
  applyBoardLabel?: string;
  deckQtyByOracle?: Record<string, number>;
};

function identityOf(c: DrawerCardView): string[] {
  return normalizeColorIdentity(
    c.effective_color_identity ?? c.color_identity ?? []
  );
}

function matchesIdentityFilter(
  c: DrawerCardView,
  filter: IdentityFilter
): boolean {
  if (filter === "all") return true;
  const id = identityOf(c);
  if (filter === "colorless") return id.length === 0;
  if (filter === "mono") return id.length === 1;
  if (filter === "multi") return id.length >= 2;
  // specific color: card includes that color
  return id.includes(filter);
}

export function DrawerPanel({
  onAddCard,
  onAdjustCard,
  onApplyDrawer,
  commanderColorIdentity = [],
  applyBoardLabel = "Mainboard",
  deckQtyByOracle = {},
}: Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [drawers, setDrawers] = useState<Drawer[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [cards, setCards] = useState<DrawerCardView[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingCards, setLoadingCards] = useState(false);
  const [viewMode, setViewMode] = useState<DrawerViewMode>(() =>
    getDrawerViewMode()
  );
  const [sortKey, setSortKey] = useState<CardSortKey>(() => {
    const k = getDrawerSortKey();
    return (CARD_SORT_OPTIONS.some((o) => o.id === k) ? k : "name") as CardSortKey;
  });
  const [filter, setFilter] = useState("");
  const [identityFilter, setIdentityFilter] = useState<IdentityFilter>("all");
  const [error, setError] = useState<string | null>(null);
  const [respectIdentity, setRespectIdentity] = useState(true);
  const [applying, setApplying] = useState(false);
  const [applyResult, setApplyResult] = useState<string | null>(null);
  const [hover, setHover] = useState<{
    src: string;
    name: string;
    x: number;
    y: number;
  } | null>(null);
  const [lightbox, setLightbox] = useState<{ src: string; name: string } | null>(
    null
  );

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

  const sortedCards = useMemo(
    () => sortCardsBy(cards, sortKey),
    [cards, sortKey]
  );

  const q = filter.trim().toLowerCase();
  const visible = useMemo(() => {
    let list = sortedCards;
    if (q) {
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.type_line.toLowerCase().includes(q)
      );
    }
    if (identityFilter !== "all") {
      list = list.filter((c) => matchesIdentityFilter(c, identityFilter));
    }
    return list;
  }, [sortedCards, q, identityFilter]);

  function onViewMode(mode: DrawerViewMode) {
    setViewMode(mode);
    setDrawerViewMode(mode);
  }

  function onSortKeyChange(key: CardSortKey) {
    setSortKey(key);
    setDrawerSortKey(key);
  }

  const hasCommanderIdentity = commanderColorIdentity.length > 0;

  const { eligible, excluded } = useMemo(() => {
    const ok: DrawerCardView[] = [];
    const no: DrawerCardView[] = [];
    for (const c of visible) {
      const printedOk =
        !respectIdentity ||
        !hasCommanderIdentity ||
        fitsColorIdentity(identityOf(c), commanderColorIdentity);
      const usefulOk = isUsefulInDeck(c.useful_in, commanderColorIdentity);
      if (printedOk && usefulOk) ok.push(c);
      else no.push(c);
    }
    return { eligible: ok, excluded: no };
  }, [visible, respectIdentity, hasCommanderIdentity, commanderColorIdentity]);

  async function handleApply() {
    if (!onApplyDrawer || eligible.length === 0) return;
    const msg =
      excluded.length > 0
        ? `Add ${eligible.length} card(s) to ${applyBoardLabel}?\n${excluded.length} excluded by color identity.`
        : `Add ${eligible.length} card(s) to ${applyBoardLabel}?`;
    if (!confirm(msg)) return;
    setApplying(true);
    setApplyResult(null);
    setError(null);
    try {
      await onApplyDrawer(eligible);
      setApplyResult(
        excluded.length > 0
          ? `Added ${eligible.length}, skipped ${excluded.length}`
          : `Added ${eligible.length} card(s)`
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Apply failed.");
    } finally {
      setApplying(false);
    }
  }

  if (!user) return null;

  const FILTERS: { id: IdentityFilter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "colorless", label: "Colorless" },
    { id: "mono", label: "Mono" },
    { id: "multi", label: "Multi" },
    { id: "W", label: "W" },
    { id: "U", label: "U" },
    { id: "B", label: "B" },
    { id: "R", label: "R" },
    { id: "G", label: "G" },
  ];

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
            <Link
              to="/drawers"
              className={styles.manageLink}
              onClick={() => setOpen(false)}
            >
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

          <div className={styles.idFilters} role="group" aria-label="Identity filter">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                className={`${styles.idChip}${
                  identityFilter === f.id ? ` ${styles.idChipOn}` : ""
                }`}
                onClick={() => setIdentityFilter(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>

          {onApplyDrawer && (
            <div className={styles.applyBar}>
              {hasCommanderIdentity && (
                <label className={styles.applyCheck}>
                  <input
                    type="checkbox"
                    checked={respectIdentity}
                    onChange={(e) => setRespectIdentity(e.target.checked)}
                  />
                  Color identity
                </label>
              )}
              <button
                type="button"
                className={styles.applyBtn}
                disabled={applying || loadingCards || eligible.length === 0}
                onClick={() => void handleApply()}
              >
                {applying
                  ? "Applying…"
                  : `Apply (${eligible.length}${
                      excluded.length ? ` · −${excluded.length}` : ""
                    })`}
              </button>
            </div>
          )}
          {applyResult && <p className={styles.applyResult}>{applyResult}</p>}

          <div className={styles.cardList}>
            {loadingCards && <p className={styles.muted}>Loading cards…</p>}
            {!loadingCards && visible.length === 0 && (
              <p className={styles.muted}>No cards in this drawer.</p>
            )}
            {visible.map((c) => {
              const printedOk =
                !respectIdentity ||
                !hasCommanderIdentity ||
                fitsColorIdentity(identityOf(c), commanderColorIdentity);
              const usefulOk = isUsefulInDeck(
                c.useful_in,
                commanderColorIdentity
              );
              const blocked = !printedOk || !usefulOk;
              const inDeck = deckQtyByOracle[c.oracle_id.toLowerCase()] ?? 0;
              return (
                <div
                  key={c.id}
                  className={`${styles.cardRow}${
                    blocked ? ` ${styles.cardRowBlocked}` : ""
                  }`}
                  title={
                    blocked
                      ? !printedOk
                        ? "Outside commander color identity"
                        : "Not marked useful for this deck identity"
                      : undefined
                  }
                >
                  {viewMode === "image" && (
                    <button
                      type="button"
                      className={styles.thumbBtn}
                      onClick={() => {
                        if (c.image_url)
                          setLightbox({ src: c.image_url, name: c.name });
                      }}
                      onMouseEnter={(e) => {
                        if (!c.image_url) return;
                        setHover({
                          src: c.image_url,
                          name: c.name,
                          x: e.clientX,
                          y: e.clientY,
                        });
                      }}
                      onMouseMove={(e) => {
                        if (!c.image_url) return;
                        setHover({
                          src: c.image_url,
                          name: c.name,
                          x: e.clientX,
                          y: e.clientY,
                        });
                      }}
                      onMouseLeave={() => setHover(null)}
                    >
                      {c.image_url ? (
                        <img src={c.image_url} alt="" />
                      ) : (
                        <span />
                      )}
                    </button>
                  )}
                  <div className={styles.meta}>
                    <span className={styles.name}>
                      {c.name}
                      {inDeck > 0 && (
                        <span className={styles.inDeck} title="In this deck">
                          {" "}
                          ×{inDeck}
                        </span>
                      )}
                    </span>
                    <span className={styles.type}>{c.type_line}</span>
                  </div>
                  {c.mana_cost && (
                    <span className={styles.mana}>
                      <ManaCost cost={c.mana_cost} size={12} />
                    </span>
                  )}
                  <div className={styles.qtyBtns}>
                    {onAdjustCard && (
                      <button
                        type="button"
                        className={styles.qtyBtn}
                        disabled={blocked || inDeck <= 0}
                        onClick={() => onAdjustCard(c, -1)}
                        title="Remove one from deck"
                      >
                        −
                      </button>
                    )}
                    <button
                      type="button"
                      className={styles.addBtn}
                      onClick={() => onAddCard(c)}
                      title={
                        blocked
                          ? "Outside color identity"
                          : `Add ${c.name}`
                      }
                      disabled={blocked}
                    >
                      +
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {hover &&
        createPortal(
          <div
            className={styles.hoverPreview}
            style={{ left: hover.x, top: hover.y }}
          >
            <img src={hover.src} alt={hover.name} />
          </div>,
          document.body
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
