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
import { useDraggablePanel } from "../hooks/useDraggablePanel";
import { ConfirmDialog } from "./ConfirmDialog";
import styles from "./DrawerPanel.module.css";

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

function matchesColorFilters(
  c: DrawerCardView,
  selected: Set<string>
): boolean {
  if (selected.size === 0) return true;
  const id = identityOf(c);
  const modes = [...selected].filter((s) =>
    ["colorless", "mono", "multi", "wubrg"].includes(s)
  );
  const colors = [...selected].filter((s) =>
    ["W", "U", "B", "R", "G"].includes(s)
  );

  // Color letters: AND — card must include every selected color
  for (const col of colors) {
    if (!id.includes(col)) return false;
  }

  // Modes: if any selected, card must satisfy ALL selected modes
  for (const m of modes) {
    if (m === "colorless" && id.length !== 0) return false;
    if (m === "mono" && id.length !== 1) return false;
    if (m === "multi" && id.length < 2) return false;
    if (m === "wubrg" && id.length !== 5) return false;
  }
  return true;
}

function matchesUsefulFilters(
  c: DrawerCardView,
  selected: Set<string>
): boolean {
  if (selected.size === 0) return true;
  const tags = new Set(
    (c.useful_in ?? []).map((t) =>
      ["W", "U", "B", "R", "G"].includes(t.toUpperCase())
        ? t.toUpperCase()
        : t.toLowerCase()
    )
  );
  // AND: card must have every selected useful-in tag
  for (const s of selected) {
    if (!tags.has(s)) return false;
  }
  return true;
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
  const { panelRef, anchorRef, panelStyle, onHandlePointerDown, onResizePointerDown } =
    useDraggablePanel(open);
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
  const [colorFilters, setColorFilters] = useState<Set<string>>(() => new Set());
  const [usefulFilters, setUsefulFilters] = useState<Set<string>>(() => new Set());
  /** Include cards with tier <= maxTier (1 = highest). null = no limit. */
  const [maxTier, setMaxTier] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [respectIdentity, setRespectIdentity] = useState(true);
  const [respectUseful, setRespectUseful] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applyResult, setApplyResult] = useState<string | null>(null);
  const [applyMissingOnly, setApplyMissingOnly] = useState(true);
  const [applyConfirm, setApplyConfirm] = useState<string | null>(null);
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
    list = list.filter((c) => matchesColorFilters(c, colorFilters));
    list = list.filter((c) => matchesUsefulFilters(c, usefulFilters));
    if (maxTier != null) {
      list = list.filter((c) => (c.tier ?? 1) <= maxTier);
    }
    return list;
  }, [sortedCards, q, colorFilters, usefulFilters, maxTier]);

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
      const usefulOk =
        !respectUseful ||
        isUsefulInDeck(c.useful_in, commanderColorIdentity);
      if (printedOk && usefulOk) ok.push(c);
      else no.push(c);
    }
    return { eligible: ok, excluded: no };
  }, [visible, respectIdentity, respectUseful, hasCommanderIdentity, commanderColorIdentity]);

  const applySet = useMemo(() => {
    if (!applyMissingOnly) return eligible;
    return eligible.filter((c) => {
      const oid = String(c.oracle_id ?? "").toLowerCase();
      return !oid || (deckQtyByOracle[oid] ?? 0) === 0;
    });
  }, [eligible, applyMissingOnly, deckQtyByOracle]);

  const alreadyInDeck = eligible.length - applySet.length;

  function requestApply() {
    if (!onApplyDrawer || applySet.length === 0) return;
    const lines = [
      `Add ${applySet.length} card${applySet.length === 1 ? "" : "s"} to ${applyBoardLabel}?`,
    ];
    if (applyMissingOnly && alreadyInDeck > 0) {
      lines.push(`${alreadyInDeck} already in the deck will be skipped.`);
    }
    if (excluded.length > 0) {
      lines.push(`${excluded.length} excluded by identity / useful-in filters.`);
    }
    setApplyConfirm(lines.join("\n"));
  }

  async function confirmApply() {
    setApplyConfirm(null);
    if (!onApplyDrawer || applySet.length === 0) return;
    setApplying(true);
    setApplyResult(null);
    setError(null);
    try {
      await onApplyDrawer(applySet);
      const extra: string[] = [];
      if (applyMissingOnly && alreadyInDeck > 0) {
        extra.push(`skipped ${alreadyInDeck} already in deck`);
      }
      if (excluded.length > 0) extra.push(`filtered ${excluded.length}`);
      setApplyResult(
        extra.length
          ? `Added ${applySet.length}, ${extra.join(", ")}`
          : `Added ${applySet.length} card${applySet.length === 1 ? "" : "s"}`
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Apply failed.");
    } finally {
      setApplying(false);
    }
  }

  if (!user) return null;

  function toggleInSet(
    setter: (fn: (prev: Set<string>) => Set<string>) => void,
    id: string
  ) {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const COLOR_FILTERS: { id: string; label: string }[] = [
    { id: "colorless", label: "Colorless" },
    { id: "mono", label: "Mono" },
    { id: "multi", label: "Multi" },
    { id: "wubrg", label: "WUBRG" },
    { id: "W", label: "W" },
    { id: "U", label: "U" },
    { id: "B", label: "B" },
    { id: "R", label: "R" },
    { id: "G", label: "G" },
  ];

  const USEFUL_FILTERS: { id: string; label: string }[] = [
    { id: "colorless", label: "Colorless" },
    { id: "mono", label: "Mono" },
    { id: "multi", label: "Multi" },
    { id: "wubrg", label: "WUBRG" },
    { id: "W", label: "W" },
    { id: "U", label: "U" },
    { id: "B", label: "B" },
    { id: "R", label: "R" },
    { id: "G", label: "G" },
  ];

  return (
    <div className={styles.wrap} ref={anchorRef}>
      <button
        type="button"
        className={`${styles.toggleBtn}${open ? ` ${styles.toggleBtnOpen}` : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        Drawers
      </button>

      {open &&
        createPortal(
        <div className={styles.panel} ref={panelRef} style={panelStyle}>
          <div
            className={styles.panelHeader}
            onPointerDown={onHandlePointerDown}
          >
            <span className={styles.panelTitle}>Drawers</span>
            <Link
              to="/drawers"
              className={styles.manageLink}
              data-no-drag
              onClick={() => setOpen(false)}
            >
              Manage
            </Link>
            <button
              type="button"
              className={styles.closeBtn}
              data-no-drag
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

          <div className={styles.collapseSection}>
            <button
              type="button"
              className={styles.collapseBtn}
              data-no-drag
              aria-expanded={filtersOpen}
              onClick={() => setFiltersOpen((v) => !v)}
            >
              <span>Filters</span>
              <span className={styles.chevron}>{filtersOpen ? "▾" : "▸"}</span>
            </button>
            {filtersOpen && (
              <div className={styles.collapseBody}>
          <div className={styles.filterBlock}>
            <span className={styles.filterLabel}>Color identity</span>
            <div className={styles.idFilters} role="group" aria-label="Color identity filters">
              {COLOR_FILTERS.map((f) => (
                <button
                  key={`ci-${f.id}`}
                  type="button"
                  className={`${styles.idChip}${
                    colorFilters.has(f.id) ? ` ${styles.idChipOn}` : ""
                  }`}
                  onClick={() => toggleInSet(setColorFilters, f.id)}
                >
                  {f.label}
                </button>
              ))}
              {colorFilters.size > 0 && (
                <button
                  type="button"
                  className={styles.clearFilters}
                  onClick={() => setColorFilters(new Set())}
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          <div className={styles.filterBlock}>
            <span className={styles.filterLabel}>Useful in</span>
            <div className={styles.idFilters} role="group" aria-label="Useful in filters">
              {USEFUL_FILTERS.map((f) => (
                <button
                  key={`ui-${f.id}`}
                  type="button"
                  className={`${styles.idChip}${
                    usefulFilters.has(f.id) ? ` ${styles.idChipOn}` : ""
                  }`}
                  onClick={() => toggleInSet(setUsefulFilters, f.id)}
                >
                  {f.label}
                </button>
              ))}
              {usefulFilters.size > 0 && (
                <button
                  type="button"
                  className={styles.clearFilters}
                  onClick={() => setUsefulFilters(new Set())}
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          <div className={styles.filterBlock}>
            <span className={styles.filterLabel}>Tier (1 = best)</span>
            <div className={styles.tierFilterRow}>
              <button
                type="button"
                className={styles.qtyBtn}
                disabled={maxTier == null || maxTier <= 1}
                onClick={() =>
                  setMaxTier((v) => (v == null ? 1 : Math.max(1, v - 1)))
                }
              >
                −
              </button>
              <input
                className={styles.tierInput}
                type="number"
                min={1}
                placeholder="Any"
                value={maxTier ?? ""}
                onChange={(e) => {
                  const raw = e.target.value.trim();
                  if (!raw) {
                    setMaxTier(null);
                    return;
                  }
                  const n = parseInt(raw, 10);
                  setMaxTier(Number.isFinite(n) && n >= 1 ? n : null);
                }}
                title="Only include tier 1 through this number"
              />
              <button
                type="button"
                className={styles.qtyBtn}
                onClick={() =>
                  setMaxTier((v) => (v == null ? 1 : v + 1))
                }
              >
                +
              </button>
              <span className={styles.tierHint}>
                {maxTier == null
                  ? "All tiers"
                  : `Tiers 1–${maxTier}`}
              </span>
              {maxTier != null && (
                <button
                  type="button"
                  className={styles.clearFilters}
                  onClick={() => setMaxTier(null)}
                >
                  Clear
                </button>
              )}
            </div>
          </div>
              </div>
            )}
          </div>

          <div className={styles.toggleRow} data-no-drag>
            <button
              type="button"
              className={`${styles.toggle}${respectIdentity ? ` ${styles.toggleOn}` : ""}`}
              aria-pressed={respectIdentity}
              onClick={() => setRespectIdentity((v) => !v)}
              title="When on, exclude cards outside commander color identity"
            >
              <span className={styles.toggleKnob} />
              <span className={styles.toggleLabel}>Color ID</span>
            </button>
            <button
              type="button"
              className={`${styles.toggle}${respectUseful ? ` ${styles.toggleOn}` : ""}`}
              aria-pressed={respectUseful}
              onClick={() => setRespectUseful((v) => !v)}
              title="When on, honor Useful-in tags on cards"
            >
              <span className={styles.toggleKnob} />
              <span className={styles.toggleLabel}>Useful in</span>
            </button>
          </div>

          {onApplyDrawer && (
            <div className={styles.applyBar} data-no-drag>
              <button
                type="button"
                className={`${styles.toggle}${applyMissingOnly ? ` ${styles.toggleOn}` : ""}`}
                aria-pressed={applyMissingOnly}
                onClick={() => setApplyMissingOnly((v) => !v)}
                title="When on, skip cards already in this deck"
              >
                <span className={styles.toggleKnob} />
                <span className={styles.toggleLabel}>Missing only</span>
              </button>
              <button
                type="button"
                className={styles.applyBtn}
                disabled={applying || loadingCards || applySet.length === 0}
                onClick={requestApply}
              >
                {applying
                  ? "Applying…"
                  : `Apply (${applySet.length}${
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
              const usefulOk =
                !respectUseful ||
                isUsefulInDeck(c.useful_in, commanderColorIdentity);
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
                      <span className={styles.tierBadge} title="Drawer tier">
                        T{c.tier ?? 1}
                      </span>
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
          <div
            className={`${styles.resizeHandle} ${styles.resizeE}`}
            data-no-drag
            onPointerDown={onResizePointerDown("e")}
          />
          <div
            className={`${styles.resizeHandle} ${styles.resizeS}`}
            data-no-drag
            onPointerDown={onResizePointerDown("s")}
          />
          <div
            className={`${styles.resizeHandle} ${styles.resizeSe}`}
            data-no-drag
            onPointerDown={onResizePointerDown("se")}
          />
        </div>
        , document.body)}

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

      {applyConfirm && (
        <ConfirmDialog
          title="Apply drawer"
          message={applyConfirm}
          confirmLabel="Apply"
          cancelLabel="Cancel"
          onConfirm={() => void confirmApply()}
          onCancel={() => setApplyConfirm(null)}
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
