import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { useArtPreferences } from "../auth/ArtPreferencesProvider";
import { fetchCardById, fetchRulings, type ScryfallRuling } from "../lib/scryfallApi";
import { cardArtPublicUrl } from "../services/cardArtService";
import type { DeckBoard, DeckCard, DeckTag } from "../types/deck";
import type { ScryfallCard } from "../types/scryfallCard";
import { getFaceImage, isMultiCard } from "../utils/scryfall";
import { CardDetail } from "./CardDetail";
import { CardImage } from "./CardImage";
import { CardArtPanel } from "./CardArtPanel";
import { DrawerPicker } from "./DrawerPicker";
import { UsefulInPicker } from "./UsefulInPicker";
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
  onCreateTag?: (name: string) => Promise<void> | void;
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

function DeckTagRows({
  tags,
  assigned,
  isOwner,
  onToggle,
}: {
  tags: DeckTag[];
  assigned: Set<string>;
  isOwner: boolean;
  onToggle: (tag: DeckTag) => void;
}) {
  const nodes = useRef(new Map<string, HTMLButtonElement>());
  const prev = useRef(new Map<string, DOMRect>());

  useLayoutEffect(() => {
    for (const tag of tags) {
      const el = nodes.current.get(tag.id);
      if (!el) continue;
      const last = el.getBoundingClientRect();
      const first = prev.current.get(tag.id);
      if (first) {
        const dx = first.left - last.left;
        const dy = first.top - last.top;
        if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
          el.animate(
            [
              {
                transform: `translate(${dx}px, ${dy}px) scale(0.55)`,
                borderRadius: "50%",
                filter: "brightness(1.15)",
              },
              {
                transform: `translate(${dx * 0.18}px, ${dy * 0.18}px) scale(1.12)`,
                borderRadius: "14px",
                offset: 0.62,
              },
              {
                transform: "translate(0, 0) scale(1)",
                borderRadius: "999px",
              },
            ],
            {
              duration: 420,
              easing: "cubic-bezier(0.22, 1, 0.36, 1)",
            }
          );
        }
      }
      prev.current.set(tag.id, last);
    }
  }, [tags, assigned]);

  const activeTags = tags.filter((t) => assigned.has(t.id));
  const availableTags = tags.filter((t) => !assigned.has(t.id));

  return (
    <>
      <div className={styles.tagLane}>
        <span className={styles.extraLabel}>Active tags</span>
        <div className={styles.tagList}>
          {activeTags.map((tag) => (
            <button
              key={tag.id}
              type="button"
              ref={(n) => {
                if (n) nodes.current.set(tag.id, n);
                else nodes.current.delete(tag.id);
              }}
              className={`${styles.tagChip} ${styles.tagChipOn}`}
              disabled={!isOwner}
              style={{
                borderColor: tag.color,
                background: `${tag.color}33`,
              }}
              onClick={() => onToggle(tag)}
            >
              {tag.name}
            </button>
          ))}
        </div>
      </div>
      <div className={styles.tagLane}>
        <span className={styles.extraLabel}>Available tags</span>
        <div className={styles.tagList}>
          {availableTags.map((tag) => (
            <button
              key={tag.id}
              type="button"
              ref={(n) => {
                if (n) nodes.current.set(tag.id, n);
                else nodes.current.delete(tag.id);
              }}
              className={styles.tagChip}
              disabled={!isOwner}
              onClick={() => onToggle(tag)}
            >
              {tag.name}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

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
  const { artByOracleId, preferredPrintings, artRevision } = useArtPreferences();
  const [baseCard, setBaseCard] = useState<ScryfallCard | null>(null);
  const [displayCard, setDisplayCard] = useState<ScryfallCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<TabId>("info");
  const [artSub, setArtSub] = useState<"upload" | "prints">("prints");
  const [infoSub, setInfoSub] = useState<"details" | "rulings">("details");
  const [rulings, setRulings] = useState<ScryfallRuling[]>([]);
  const [rulingsError, setRulingsError] = useState<string | null>(null);
  const [rulingsLoading, setRulingsLoading] = useState(false);
  const [usefulInTags, setUsefulInTags] = useState<string[]>([]);
  const [newTagName, setNewTagName] = useState("");
  const [tagBusy, setTagBusy] = useState(false);
  const [overscrollHint, setOverscrollHint] = useState<{
    dir: "up" | "down";
    ticks: number;
    top: number;
    left: number;
    width: number;
  } | null>(null);


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

  useEffect(() => {
    setInfoSub("details");
    setRulings([]);
    setRulingsError(null);
  }, [scryfallId]);

  useEffect(() => {
    if (active !== "info" || infoSub !== "rulings") return;
    const id = (displayCard ?? baseCard)?.id ?? scryfallId;
    if (!id) return;
    let cancelled = false;
    setRulingsLoading(true);
    setRulingsError(null);
    void fetchRulings(id).then(({ rulings: list, error: err }) => {
      if (cancelled) return;
      setRulingsLoading(false);
      if (err) {
        setRulingsError(err);
        setRulings([]);
        return;
      }
      setRulings(list);
    });
    return () => {
      cancelled = true;
    };
  }, [active, infoSub, scryfallId, displayCard, baseCard]);

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

      // Preferred/custom art wins over the caller's stale imageUrl prop
      setFrontSrc(
        customFront ||
          getFaceImage(display, 0) ||
          imageUrl ||
          undefined
      );
      setBackSrc(
        customBack ||
          (isMultiCard(display) ? getFaceImage(display, 1) || undefined : undefined) ||
          imageUrlBack
      );

      setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [scryfallId, artByOracleId, preferredPrintings, artRevision, imageUrl, imageUrlBack]);

  // Load Useful-in tags for drawers tab
  useEffect(() => {
    const card = displayCard ?? baseCard;
    if (!card) {
      setUsefulInTags([]);
      return;
    }
    const oracle = String(card.oracle_id ?? card.id).toLowerCase();
    let cancelled = false;
    (async () => {
      const { supabase } = await import("../lib/supabaseClient");
      const { data } = await supabase
        .from("user_cards")
        .select("useful_in")
        .eq("oracle_id", oracle)
        .maybeSingle();
      if (cancelled) return;
      const u = (data as { useful_in?: string[] | null } | null)?.useful_in;
      setUsefulInTags(u && u.length ? u : []);
    })();
    return () => {
      cancelled = true;
    };
  }, [displayCard, baseCard]);


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
      // Sub-tabs use ↑/↓; overflow moves between main tabs.
      if (e.key === "ArrowUp") {
        e.preventDefault();
        if (active === "info" && infoSub === "rulings") {
          setInfoSub("details");
          return;
        }
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
        if (active === "info" && infoSub === "details") {
          setInfoSub("rulings");
          return;
        }
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
    infoSub,
  ]);

  // Mouse back (3) / forward (4) — prev/next card while the modal is open
  useEffect(() => {
    function onMouseButton(e: MouseEvent) {
      if (e.button !== 3 && e.button !== 4) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.button === 3 && hasPrev && onPrev) onPrev();
      if (e.button === 4 && hasNext && onNext) onNext();
    }
    function onPopState() {
      // Swallow history navigation triggered by mouse back while modal is open
      history.pushState({ deckappModal: 1 }, "");
    }
    history.pushState({ deckappModal: 1 }, "");
    window.addEventListener("mouseup", onMouseButton, true);
    window.addEventListener("auxclick", onMouseButton, true);
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("mouseup", onMouseButton, true);
      window.removeEventListener("auxclick", onMouseButton, true);
      window.removeEventListener("popstate", onPopState);
      if (history.state && (history.state as { deckappModal?: number }).deckappModal) {
        history.back();
      }
    };
  }, [hasPrev, hasNext, onPrev, onNext]);


  // Wheel: vertical = tabs (only outside scrollable regions);
  // horizontal = prev/next card with gesture gating (once per flick, then paced).
  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;

    let gestureAxis: "x" | "y" | null = null;
    let gestureConsumed = false;
    let firstRepeatDone = false;
    let gestureTimer: ReturnType<typeof setTimeout> | null = null;
    let lastNavAt = 0;
    const GESTURE_IDLE_MS = 240;
    const FIRST_NAV_COOLDOWN = 900;
    const REPEAT_NAV_MS = 950;
    const FIRST_REPEAT_DELAY_MS = 1100;

    function resetGestureSoon() {
      if (gestureTimer) clearTimeout(gestureTimer);
      gestureTimer = setTimeout(() => {
        gestureAxis = null;
        gestureConsumed = false;
        firstRepeatDone = false;
      }, GESTURE_IDLE_MS);
    }

    function findVerticalScrollEl(
      start: EventTarget | null
    ): HTMLElement | null {
      let el = start instanceof Element ? start : null;
      while (el && el !== shell) {
        if (el instanceof HTMLElement) {
          const style = window.getComputedStyle(el);
          const oy = style.overflowY;
          if (
            (oy === "auto" || oy === "scroll" || oy === "overlay") &&
            el.scrollHeight > el.clientHeight + 1
          ) {
            return el;
          }
        }
        el = el.parentElement;
      }
      return null;
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

    /** Overscroll buffer: 3 filled dots at edge, 4th tick switches tabs. */
    let edgeTicks = 0;
    let edgeDir: "up" | "down" | null = null;
    const EDGE_TICKS_BEFORE_TAB = 3;

    function clearEdgeBuffer() {
      edgeTicks = 0;
      edgeDir = null;
      setOverscrollHint(null);
    }

    function showEdgeDots(
      dir: "up" | "down",
      ticks: number,
      scrollEl: HTMLElement
    ) {
      const r = scrollEl.getBoundingClientRect();
      setOverscrollHint({
        dir,
        ticks: Math.min(3, Math.max(0, ticks)),
        // Sit just outside the scrollable field
        top: dir === "up" ? r.top - 14 : r.bottom + 6,
        left: r.left,
        width: r.width,
      });
    }

    function navVertical(deltaY: number) {
      if (deltaY < 0) {
        if (active === "info" && infoSub === "rulings") {
          setInfoSub("details");
          return;
        }
        if (active === "artwork" && artSub === "upload") {
          setArtSub("prints");
          return;
        }
        const next = Math.max(0, activeIndex - 1);
        selectTab(tabs[next].id);
      } else {
        if (active === "info" && infoSub === "details") {
          setInfoSub("rulings");
          return;
        }
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

      if (preferX && isInsideHorizontalScrollRegion(e.target)) {
        return;
      }

      // Vertical over a scrollable region: allow native scroll until edge buffer
      if (!preferX) {
        const scrollEl = findVerticalScrollEl(e.target);
        if (scrollEl) {
          const atTop = scrollEl.scrollTop <= 0;
          const atBottom =
            scrollEl.scrollTop + scrollEl.clientHeight >=
            scrollEl.scrollHeight - 1;
          const scrollingUp = e.deltaY < 0;
          const scrollingDown = e.deltaY > 0;
          const pastEdge =
            (scrollingUp && atTop) || (scrollingDown && atBottom);

          if (!pastEdge) {
            clearEdgeBuffer();
            return; // native scroll
          }

          // At edge — buffered tab switch (3 dots, then switch)
          e.preventDefault();
          const dir: "up" | "down" = scrollingUp ? "up" : "down";
          if (edgeDir !== dir) {
            edgeDir = dir;
            edgeTicks = 1;
            showEdgeDots(dir, edgeTicks, scrollEl);
            return;
          }
          edgeTicks += 1;
          if (edgeTicks <= EDGE_TICKS_BEFORE_TAB) {
            showEdgeDots(dir, edgeTicks, scrollEl);
            return;
          }
          // 4th tick past edge → switch tabs
          clearEdgeBuffer();
          resetGestureSoon();
          navVertical(e.deltaY);
          return;
        }
      }

      e.preventDefault();
      clearEdgeBuffer();
      resetGestureSoon();

      if (!gestureAxis) {
        gestureAxis = preferX ? "x" : "y";
        gestureConsumed = false;
      }

      const now = Date.now();

      // Horizontal wheel no longer changes cards (mouse back/forward does)
      if (gestureAxis === "x") {
        return;
      }

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
    infoSub,
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
                key={`${displayCard.id}:${artRevision}`}
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
                  <div className={styles.subTabRail} role="tablist">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={infoSub === "details"}
                      className={`${styles.subTab}${
                        infoSub === "details" ? ` ${styles.subTabActive}` : ""
                      }`}
                      onClick={() => setInfoSub("details")}
                    >
                      Details
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={infoSub === "rulings"}
                      className={`${styles.subTab}${
                        infoSub === "rulings" ? ` ${styles.subTabActive}` : ""
                      }`}
                      onClick={() => setInfoSub("rulings")}
                    >
                      Rulings
                    </button>
                  </div>
                  {infoSub === "details" && (
                    <>
                      {error && (
                        <p className={styles.error} role="alert">
                          {error}
                        </p>
                      )}
                      {displayCard && (
                        <CardDetail
                          card={displayCard}
                          hidePrintingMeta={Boolean(
                            frontSrc &&
                              frontSrc !== getFaceImage(displayCard, 0)
                          )}
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
                    </>
                  )}
                  {infoSub === "rulings" && (
                    <div className={styles.rulingsList}>
                      {rulingsLoading && (
                        <p className={styles.rulingsMuted}>Loading rulings…</p>
                      )}
                      {rulingsError && (
                        <p className={styles.error} role="alert">
                          {rulingsError}
                        </p>
                      )}
                      {!rulingsLoading &&
                        !rulingsError &&
                        rulings.length === 0 && (
                          <p className={styles.rulingsMuted}>
                            No official rulings for this card.
                          </p>
                        )}
                      {rulings.map((r, i) => (
                        <article key={`${r.published_at ?? "r"}-${i}`} className={styles.ruling}>
                          <header className={styles.rulingMeta}>
                            <span>{r.source === "wotc" ? "WotC" : r.source ?? "Ruling"}</span>
                            {r.published_at && <time>{r.published_at}</time>}
                          </header>
                          <p className={styles.rulingBody}>{r.comment}</p>
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {active === "deck" && deck && (
                <div className={`${styles.panelScroll} ${styles.panelScrollSolid}`}>
                  <div className={styles.deckExtras}>
                    <div className={`${styles.qtyRow} ${styles.deckGroup}`}>
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
                    <label className={`${styles.boardRow} ${styles.deckGroup}`}>
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
                    <div className={`${styles.tagsBlock} ${styles.deckGroup}`}>
                      <DeckTagRows
                        tags={deck.tags}
                        assigned={assigned}
                        isOwner={deck.isOwner}
                        onToggle={deck.onToggleTag}
                      />
                      {deck.isOwner && deck.onCreateTag && (
                        <form
                          className={styles.tagCreate}
                          onSubmit={(e) => {
                            e.preventDefault();
                            const name = newTagName.trim();
                            if (!name || tagBusy) return;
                            setTagBusy(true);
                            void Promise.resolve(deck.onCreateTag!(name)).finally(
                              () => {
                                setNewTagName("");
                                setTagBusy(false);
                              }
                            );
                          }}
                        >
                          <input
                            className={styles.tagCreateInput}
                            value={newTagName}
                            onChange={(e) => setNewTagName(e.target.value)}
                            placeholder="New tag"
                            maxLength={32}
                            aria-label="New deck tag"
                          />
                          <button
                            type="submit"
                            className={styles.tagCreateBtn}
                            disabled={tagBusy || !newTagName.trim()}
                          >
                            Add
                          </button>
                        </form>
                      )}
                    </div>
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
                  <>
                    <div className={styles.usefulInBlock}>
                      <UsefulInPicker
                        oracleId={(
                          (displayCard ?? baseCard)!.oracle_id ??
                          (displayCard ?? baseCard)!.id
                        ).toLowerCase()}
                        scryfallCard={displayCard ?? baseCard!}
                        value={usefulInTags}
                        onChange={setUsefulInTags}
                      />
                    </div>
                    <div className={styles.drawersBlock}>
                      <p className={styles.drawersBlockLabel}>Drawer membership</p>
                      <DrawerPicker
                        oracleId={(
                          (displayCard ?? baseCard)!.oracle_id ??
                          (displayCard ?? baseCard)!.id
                        ).toLowerCase()}
                        scryfallCard={displayCard ?? baseCard!}
                        inline
                      />
                    </div>
                  </>
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
      {overscrollHint &&
        createPortal(
          <div
            className={styles.overscrollDots}
            style={{
              top: overscrollHint.top,
              left: overscrollHint.left,
              width: overscrollHint.width,
            }}
            data-dir={overscrollHint.dir}
            aria-hidden
          >
            {[1, 2, 3].map((n) => (
              <span
                key={n}
                className={`${styles.overscrollDot}${
                  overscrollHint.ticks >= n ? ` ${styles.overscrollDotFilled}` : ""
                }`}
              />
            ))}
          </div>,
          document.body
        )}
    </Modal>
  );
}
