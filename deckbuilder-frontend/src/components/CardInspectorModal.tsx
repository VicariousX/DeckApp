import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Link } from "react-router-dom";
import { useArtPreferences } from "../auth/ArtPreferencesProvider";
import { fetchCardById } from "../lib/scryfallApi";
import { cardArtPublicUrl } from "../services/cardArtService";
import type { DeckBoard, DeckCard, DeckTag } from "../types/deck";
import type { ScryfallCard } from "../types/scryfallCard";
import { getFaceImage, isMultiCard } from "../utils/scryfall";
import { CardDetail } from "./CardDetail";
import { CardImage } from "./CardImage";
import { CardArtPanel } from "./CardArtPanel";
import { DrawerPicker } from "./DrawerPicker";
import { Modal } from "./Modal";
import styles from "./CardInspectorModal.module.css";

const BOARDS: { id: DeckBoard; label: string }[] = [
  { id: "commander", label: "Commander" },
  { id: "main", label: "Mainboard" },
  { id: "side", label: "Sideboard" },
  { id: "maybe", label: "Maybeboard" },
];

export type CardInspectorDeckControls = {
  card: DeckCard;
  isOwner: boolean;
  tags: DeckTag[];
  onQty: (delta: number) => void;
  onBoard: (board: DeckBoard) => void;
  onRemove: () => void;
  onToggleTag: (tag: DeckTag) => void;
};

type Props = {
  scryfallId: string;
  name?: string;
  imageUrl?: string;
  imageUrlBack?: string;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
  deck?: CardInspectorDeckControls;
};

type TabId = "info" | "deck" | "drawers" | "artwork";

export function CardInspectorModal({
  scryfallId,
  name,
  imageUrl,
  imageUrlBack,
  onClose,
  onPrev,
  onNext,
  hasPrev = false,
  hasNext = false,
  deck,
}: Props) {
  const { artByOracleId, preferredPrintings } = useArtPreferences();
  const [baseCard, setBaseCard] = useState<ScryfallCard | null>(null);
  const [displayCard, setDisplayCard] = useState<ScryfallCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<TabId>("info");
  const [artSub, setArtSub] = useState<"upload" | "prints">("prints");
  const [contentKey, setContentKey] = useState(0);
  const DEFAULT_MODAL_SIZE = { w: 860, h: 700 };
  /** Fixed until the user drags the resize handle. */
  const [modalSize, setModalSize] = useState(DEFAULT_MODAL_SIZE);
  const resizing = useRef<null | {
    startX: number;
    startY: number;
    startW: number;
    startH: number;
  }>(null);
  const shellRef = useRef<HTMLDivElement | null>(null);

  const [frontSrc, setFrontSrc] = useState<string | undefined>(imageUrl);
  const [backSrc, setBackSrc] = useState<string | undefined>(imageUrlBack);

  const tabs = useMemo(() => {
    const list: { id: TabId; label: string }[] = [{ id: "info", label: "Info" }];
    if (deck) list.push({ id: "deck", label: "Deck" });
    list.push(
      { id: "drawers", label: "Drawers" },
      { id: "artwork", label: "Artwork" }
    );
    return list;
  }, [deck]);

  const activeIndex = Math.max(
    0,
    tabs.findIndex((t) => t.id === active)
  );

  useEffect(() => {
    if (!tabs.some((t) => t.id === active)) setActive("info");
  }, [tabs, active]);

  // Load base + preferred printing so both faces use the same preferred art
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      const { card: c, error: err } = await fetchCardById(scryfallId);
      if (cancelled) return;
      if (err || !c) {
        setError(err ?? "Could not load card details.");
        setBaseCard(null);
        setDisplayCard(null);
        setLoading(false);
        return;
      }
      setBaseCard(c);

      const oracleId = (c.oracle_id ?? c.id).toLowerCase();
      const art = artByOracleId.get(oracleId);
      let display: ScryfallCard = c;

      if (art?.preferred_scryfall_id) {
        const prefId = String(art.preferred_scryfall_id).toLowerCase();
        if (prefId !== String(c.id).toLowerCase()) {
          let pref = preferredPrintings.get(prefId);
          if (!pref) {
            const { card: prefCard } = await fetchCardById(prefId);
            if (cancelled) return;
            pref = prefCard ?? undefined;
          }
          if (pref) display = pref;
        }
      }

      setDisplayCard(display);

      // Resolve per-face URLs (custom > preferred printing faces)
      const customFront = art?.custom_front_path
        ? cardArtPublicUrl(art.custom_front_path)
        : "";
      const customBack = art?.custom_back_path
        ? cardArtPublicUrl(art.custom_back_path)
        : "";

      setFrontSrc(
        customFront ||
          imageUrl ||
          getFaceImage(display, 0) ||
          undefined
      );
      setBackSrc(
        customBack ||
          imageUrlBack ||
          (isMultiCard(display) ? getFaceImage(display, 1) || undefined : undefined)
      );

      setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [scryfallId, artByOracleId, preferredPrintings, imageUrl, imageUrlBack]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "ArrowLeft" && hasPrev && onPrev) {
        e.preventDefault();
        onPrev();
        return;
      }
      if (e.key === "ArrowRight" && hasNext && onNext) {
        e.preventDefault();
        onNext();
        return;
      }
      // Artwork sub-tabs use ↑/↓; overflow moves between main tabs.
      // ←/→ always change cards when available.
      if (e.key === "ArrowUp") {
        e.preventDefault();
        if (active === "artwork" && artSub === "upload") {
          setArtSub("prints");
          return;
        }
        const next = Math.max(0, activeIndex - 1);
        selectTab(tabs[next].id);
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (active === "artwork" && artSub === "prints") {
          setArtSub("upload");
          return;
        }
        if (active === "artwork" && artSub === "upload") {
          return;
        }
        const next = Math.min(tabs.length - 1, activeIndex + 1);
        selectTab(tabs[next].id);
        return;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    hasPrev,
    hasNext,
    onPrev,
    onNext,
    onClose,
    activeIndex,
    tabs,
    active,
    artSub,
  ]);


  // Wheel: vertical = tabs (only outside scrollable regions);
  // horizontal = prev/next card with gesture gating (once per flick, then paced).
  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;

    let gestureAxis: "x" | "y" | null = null;
    let gestureConsumed = false;
    let gestureTimer: ReturnType<typeof setTimeout> | null = null;
    let lastNavAt = 0;
    const GESTURE_IDLE_MS = 160;
    const FIRST_NAV_COOLDOWN = 420;
    const REPEAT_NAV_MS = 520;

    function resetGestureSoon() {
      if (gestureTimer) clearTimeout(gestureTimer);
      gestureTimer = setTimeout(() => {
        gestureAxis = null;
        gestureConsumed = false;
      }, GESTURE_IDLE_MS);
    }

    /** True if target is inside any vertically scrollable box (even at ends). */
    function isInsideVerticalScrollRegion(start: EventTarget | null): boolean {
      let el = start instanceof Element ? start : null;
      while (el && el !== shell) {
        if (el instanceof HTMLElement) {
          const style = window.getComputedStyle(el);
          const oy = style.overflowY;
          if (
            (oy === "auto" || oy === "scroll" || oy === "overlay") &&
            el.scrollHeight > el.clientHeight + 1
          ) {
            return true;
          }
        }
        el = el.parentElement;
      }
      return false;
    }

    function isInsideHorizontalScrollRegion(start: EventTarget | null): boolean {
      let el = start instanceof Element ? start : null;
      while (el && el !== shell) {
        if (el instanceof HTMLElement) {
          const style = window.getComputedStyle(el);
          const ox = style.overflowX;
          if (
            (ox === "auto" || ox === "scroll" || ox === "overlay") &&
            el.scrollWidth > el.clientWidth + 1
          ) {
            return true;
          }
        }
        el = el.parentElement;
      }
      return false;
    }

    function navVertical(deltaY: number) {
      if (deltaY < 0) {
        if (active === "artwork" && artSub === "upload") {
          setArtSub("prints");
          return;
        }
        const next = Math.max(0, activeIndex - 1);
        selectTab(tabs[next].id);
      } else {
        if (active === "artwork" && artSub === "prints") {
          setArtSub("upload");
          return;
        }
        if (active === "artwork" && artSub === "upload") return;
        const next = Math.min(tabs.length - 1, activeIndex + 1);
        selectTab(tabs[next].id);
      }
    }

    function navHorizontal(deltaX: number) {
      if (deltaX > 0 && hasNext && onNext) onNext();
      else if (deltaX < 0 && hasPrev && onPrev) onPrev();
    }

    function onWheel(e: WheelEvent) {
      const absX = Math.abs(e.deltaX);
      const absY = Math.abs(e.deltaY);
      if (absX < 4 && absY < 4) return;

      const preferX = absX > absY;

      // Never steal vertical scroll from print grids / lists
      if (!preferX && isInsideVerticalScrollRegion(e.target)) {
        return;
      }
      if (preferX && isInsideHorizontalScrollRegion(e.target)) {
        return;
      }

      e.preventDefault();
      resetGestureSoon();

      if (!gestureAxis) {
        gestureAxis = preferX ? "x" : "y";
        gestureConsumed = false;
      }

      const now = Date.now();

      if (gestureAxis === "x") {
        // First tick of a horizontal gesture → one card; further ticks paced
        if (!gestureConsumed) {
          gestureConsumed = true;
          lastNavAt = now;
          navHorizontal(e.deltaX);
          return;
        }
        if (now - lastNavAt >= REPEAT_NAV_MS) {
          lastNavAt = now;
          navHorizontal(e.deltaX);
        }
        return;
      }

      // vertical tabs
      if (!gestureConsumed) {
        gestureConsumed = true;
        lastNavAt = now;
        navVertical(e.deltaY);
        return;
      }
      if (now - lastNavAt >= FIRST_NAV_COOLDOWN) {
        lastNavAt = now;
        navVertical(e.deltaY);
      }
    }

    shell.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      shell.removeEventListener("wheel", onWheel);
      if (gestureTimer) clearTimeout(gestureTimer);
    };
  }, [
    active,
    artSub,
    activeIndex,
    tabs,
    hasNext,
    hasPrev,
    onNext,
    onPrev,
  ]);

  function selectTab(id: TabId) {
    if (id === active) return;
    setActive(id);
    setContentKey((k) => k + 1);
  }

  function onResizePointerDown(e: ReactPointerEvent) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const el = shellRef.current?.parentElement; // .modal
    const rect = (el ?? shellRef.current)?.getBoundingClientRect();
    if (!rect) return;
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    resizing.current = {
      startX: e.clientX,
      startY: e.clientY,
      startW: modalSize.w,
      startH: modalSize.h,
    };
  }

  useEffect(() => {
    function onMove(e: PointerEvent) {
      if (!resizing.current) return;
      const r = resizing.current;
      const w = Math.max(520, Math.min(window.innerWidth - 24, r.startW + (e.clientX - r.startX)));
      const h = Math.max(420, Math.min(window.innerHeight - 24, r.startH + (e.clientY - r.startY)));
      setModalSize({ w, h });
    }
    function onUp() {
      resizing.current = null;
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, []);

  const displayName = displayCard?.name ?? baseCard?.name ?? name ?? "Card";
  const assigned = new Set(deck?.card.tag_ids ?? []);
  const above = tabs.slice(0, activeIndex);
  const below = tabs.slice(activeIndex + 1);

  function handleRemove() {
    if (!deck) return;
    deck.onRemove();
    if (hasNext && onNext) onNext();
    else onClose();
  }

  return (
    <Modal
      onClose={onClose}
      hideClose
      style={{
        width: modalSize.w,
        height: modalSize.h,
        maxWidth: "none",
        maxHeight: "none",
      }}
    >
      <div className={styles.shell} ref={shellRef}>
        {(hasPrev || hasNext) && (
          <div className={styles.navRow}>
            <button
              type="button"
              className={styles.navBtn}
              disabled={!hasPrev}
              onClick={onPrev}
              aria-label="Previous card"
            >
              ← Prev
            </button>
            <span className={styles.navHint}>
              ↑↓ tabs/sub · ←→ cards · Esc
            </span>
            <button
              type="button"
              className={styles.navBtn}
              disabled={!hasNext}
              onClick={onNext}
              aria-label="Next card"
            >
              Next →
            </button>
          </div>
        )}

        <div className={styles.layout}>
          <div className={styles.visual}>
            {loading && (
              <div className={styles.imagePlaceholder}>Loading…</div>
            )}
            {!loading && displayCard && (
              <CardImage
                key={displayCard.id}
                card={displayCard}
                overrideFrontSrc={frontSrc}
                overrideBackSrc={backSrc}
                bothLayout="stack"
                tilt
                hideFaceBadge
              />
            )}
            {!loading && !displayCard && (
              frontSrc ? (
                <img
                  src={frontSrc}
                  alt={displayName}
                  className={styles.image}
                />
              ) : (
                <div className={styles.imagePlaceholder}>{displayName}</div>
              )
            )}
          </div>

          <div className={styles.body}>
            {above.length > 0 && (
              <div className={styles.tabRail} role="tablist">
                {above.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    className={styles.tabPill}
                    onClick={() => selectTab(t.id)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            )}

            <div
              key={contentKey}
              className={styles.tabPanel}
              role="tabpanel"
            >
              <div className={styles.tabPanelTitle}>
                <span>{tabs[activeIndex]?.label}</span>
                {active === "drawers" && (
                  <Link
                    to="/drawers"
                    className={styles.manageLink}
                    onClick={onClose}
                  >
                    Manage drawers →
                  </Link>
                )}
              </div>

              {active === "info" && (
                <div className={styles.panelScroll}>
                  {error && (
                    <p className={styles.error} role="alert">
                      {error}
                    </p>
                  )}
                  {displayCard && (
                    <CardDetail
                      card={displayCard}
                      hidePrintingMeta={Boolean(frontSrc && frontSrc !== getFaceImage(displayCard, 0))}
                    />
                  )}
                  {!displayCard && !loading && (
                    <h2 className={styles.fallbackTitle}>{displayName}</h2>
                  )}
                  <Link
                    to={`/card/${scryfallId}`}
                    className={styles.detailLink}
                    onClick={onClose}
                  >
                    Open card page →
                  </Link>
                </div>
              )}

              {active === "deck" && deck && (
                <div className={styles.panelScroll}>
                  <div className={styles.deckExtras}>
                    <div className={styles.qtyRow}>
                      <span className={styles.extraLabel}>Quantity</span>
                      <div className={styles.qtyControls}>
                        <button
                          type="button"
                          className={styles.qtyBtn}
                          disabled={!deck.isOwner}
                          onClick={() => deck.onQty(-1)}
                        >
                          −
                        </button>
                        <span className={styles.qtyValue}>
                          {deck.card.quantity}
                        </span>
                        <button
                          type="button"
                          className={styles.qtyBtn}
                          disabled={!deck.isOwner}
                          onClick={() => deck.onQty(1)}
                        >
                          +
                        </button>
                      </div>
                    </div>
                    <label className={styles.boardRow}>
                      <span className={styles.extraLabel}>Board</span>
                      <select
                        className={styles.boardSelect}
                        value={deck.card.board}
                        disabled={!deck.isOwner}
                        onChange={(e) =>
                          deck.onBoard(e.target.value as DeckBoard)
                        }
                      >
                        {BOARDS.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    {deck.tags.length > 0 && (
                      <div className={styles.tagsBlock}>
                        <span className={styles.extraLabel}>Deck tags</span>
                        <div className={styles.tagList}>
                          {deck.tags.map((tag) => {
                            const on = assigned.has(tag.id);
                            return (
                              <button
                                key={tag.id}
                                type="button"
                                className={`${styles.tagChip}${
                                  on ? ` ${styles.tagChipOn}` : ""
                                }`}
                                disabled={!deck.isOwner}
                                style={
                                  on
                                    ? {
                                        borderColor: tag.color,
                                        background: `${tag.color}33`,
                                      }
                                    : undefined
                                }
                                onClick={() => deck.onToggleTag(tag)}
                              >
                                {tag.name}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                  {deck.isOwner && (
                    <div className={styles.deckFooter}>
                      <button
                        type="button"
                        className={styles.removeBtn}
                        onClick={handleRemove}
                      >
                        Remove from deck
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Keep mounted so drawer list cache survives tab switches */}
              <div
                className={styles.panelScroll}
                hidden={active !== "drawers"}
                style={active !== "drawers" ? { display: "none" } : undefined}
              >
                {displayCard || baseCard ? (
                  <DrawerPicker
                    oracleId={(
                      (displayCard ?? baseCard)!.oracle_id ??
                      (displayCard ?? baseCard)!.id
                    ).toLowerCase()}
                    scryfallCard={displayCard ?? baseCard!}
                    inline
                  />
                ) : (
                  <p className={styles.muted}>Load card to manage drawers.</p>
                )}
              </div>

              {active === "artwork" && (
                <div className={styles.panelScroll}>
                  <div className={styles.subTabRail} role="tablist">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={artSub === "prints"}
                      className={`${styles.subTab}${
                        artSub === "prints" ? ` ${styles.subTabActive}` : ""
                      }`}
                      onClick={() => setArtSub("prints")}
                    >
                      Printings
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={artSub === "upload"}
                      className={`${styles.subTab}${
                        artSub === "upload" ? ` ${styles.subTabActive}` : ""
                      }`}
                      onClick={() => setArtSub("upload")}
                    >
                      Upload
                    </button>
                  </div>
                  {displayCard || baseCard ? (
                    <CardArtPanel
                      card={displayCard ?? baseCard!}
                      embedded
                      forceSub={artSub}
                    />
                  ) : (
                    <p className={styles.muted}>Load card to edit art.</p>
                  )}
                </div>
              )}
            </div>

            {below.length > 0 && (
              <div className={styles.tabRail} role="tablist">
                {below.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    className={styles.tabPill}
                    onClick={() => selectTab(t.id)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div
          className={styles.resizeHandle}
          onPointerDown={onResizePointerDown}
          title="Drag to resize"
        />
      </div>
    </Modal>
  );
}
