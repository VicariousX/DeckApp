import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Link } from "react-router-dom";
import { useArtPreferences } from "../auth/ArtPreferencesProvider";
import { fetchCardById, fetchRulings, type ScryfallRuling } from "../lib/scryfallApi";
import { cardArtPublicUrl } from "../services/cardArtService";
import type { ScryfallCard } from "../types/scryfallCard";
import { getFaceImage, isMultiCard } from "../utils/scryfall";
import { CardImage } from "./CardImage";
import { Modal } from "./Modal";
import { readImageShown, writeImageShown } from "../lib/inspectorPrefs";
import { useIsMobile } from "../hooks/useIsMobile";
import {
  ArtworkTab,
  ART_SUBS,
  CollectionsTab,
  DeckTab,
  DrawersTab,
  InfoTab,
  INFO_SUBS,
  MechanicsTab,
  SubTabRail,
  type CardInspectorCollectionControls,
  type CardInspectorDeckControls,
  type CardInspectorDrawerControls,
  type InspectorTab,
  type InspectorTabId,
} from "./inspector";
import styles from "./CardInspectorModal.module.css";

export type {
  CardInspectorDeckControls,
  CardInspectorDrawerControls,
  CardInspectorCollectionControls,
  InspectorTabId,
} from "./inspector";

type TabId = InspectorTabId;

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
  drawer?: CardInspectorDrawerControls;
  collection?: CardInspectorCollectionControls;
  initialTab?: TabId;
  initialInfoSub?: "details" | "rulings";
  initialArtSub?: "upload" | "prints" | "proxy";
  onTabChange?: (
    tab: TabId,
    infoSub: "details" | "rulings",
    artSub: "upload" | "prints" | "proxy"
  ) => void;
};

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
  drawer,
  collection,
  initialTab = "info",
  initialInfoSub = "details",
  initialArtSub = "prints",
  onTabChange,
}: Props) {
  const isMobile = useIsMobile();
  const { artByOracleId, preferredPrintings, artRevision } = useArtPreferences();
  const [baseCard, setBaseCard] = useState<ScryfallCard | null>(null);
  const [displayCard, setDisplayCard] = useState<ScryfallCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<TabId>(initialTab);
  const [subByTab, setSubByTab] = useState<Record<string, string>>({
    info: initialInfoSub,
    artwork: initialArtSub,
  });
  const infoSub = (subByTab.info ?? "details") as "details" | "rulings";
  const artSub = (subByTab.artwork ?? "prints") as "upload" | "prints" | "proxy";
  const [imageOpen, setImageOpen] = useState(readImageShown);
  const [drag, setDrag] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const gesture = useRef<{ x: number; y: number; fromTop: boolean } | null>(null);

  function setSub(tabId: string, subId: string) {
    setSubByTab((prev) => (prev[tabId] === subId ? prev : { ...prev, [tabId]: subId }));
  }

  useEffect(() => {
    onTabChange?.(active, infoSub, artSub);
  }, [active, infoSub, artSub, onTabChange]);

  useEffect(() => {
    if (!isMobile) return;
    if (active === "info" && infoSub === "details") return;
    setImageOpen(false);
  }, [isMobile, active, infoSub]);
  const [rulings, setRulings] = useState<ScryfallRuling[]>([]);
  const [rulingsError, setRulingsError] = useState<string | null>(null);
  const [rulingsLoading, setRulingsLoading] = useState(false);
  const [usefulInTags, setUsefulInTags] = useState<string[]>([]);


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

  const card = displayCard ?? baseCard;
  const displayName = card?.name ?? name ?? "Card";

  const tabs = useMemo<InspectorTab[]>(() => {
    return [
      {
        id: "info",
        label: "Info",
        subTabs: INFO_SUBS,
        render: (subId) => (
          <InfoTab
            subId={subId ?? "details"}
            onSelectSub={(id) => setSub("info", id)}
            displayCard={displayCard}
            displayName={displayName}
            scryfallId={scryfallId}
            frontSrc={frontSrc}
            loading={loading}
            error={error}
            onClose={onClose}
            rulings={rulings}
            rulingsLoading={rulingsLoading}
            rulingsError={rulingsError}
          />
        ),
      },
      {
        id: "deck",
        label: "Deck",
        render: () => (
          <DeckTab
            deck={deck}
            scryfallId={scryfallId}
            oracleId={card?.oracle_id}
            name={displayName}
            typeLine={card?.type_line}
            onRemove={handleRemove}
          />
        ),
      },
      {
        id: "drawers",
        label: "Drawers",
        keepMounted: true,
        titleExtra: (
          <Link to="/drawers" className={styles.manageLink} onClick={onClose}>
            Manage drawers →
          </Link>
        ),
        render: () => (
          <DrawersTab
            card={card}
            usefulInTags={usefulInTags}
            onUsefulInChange={setUsefulInTags}
            drawer={drawer}
          />
        ),
      },
      {
        id: "collections",
        label: "Collections",
        titleExtra: (
          <Link to="/collections" className={styles.manageLink} onClick={onClose}>
            Manage collections →
          </Link>
        ),
        render: () => (
          <CollectionsTab
            card={card}
            name={displayName}
            collection={collection}
          />
        ),
      },
      {
        id: "mechanics",
        label: "Mechanics",
        render: () => <MechanicsTab card={card} />,
      },
      {
        id: "artwork",
        label: "Artwork",
        subTabs: ART_SUBS,
        render: (subId) => (
          <ArtworkTab
            subId={subId ?? "prints"}
            onSelectSub={(id) => setSub("artwork", id)}
            card={card}
          />
        ),
      },
    ];
    // handleRemove is stable enough for this list; card identity drives content.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    displayCard,
    displayName,
    scryfallId,
    frontSrc,
    loading,
    error,
    onClose,
    rulings,
    rulingsLoading,
    rulingsError,
    deck,
    drawer,
    collection,
    card,
    usefulInTags,
  ]);

  const activeIndex = Math.max(
    0,
    tabs.findIndex((t) => t.id === active)
  );
  const activeTab = tabs[activeIndex];

  useEffect(() => {
    if (!tabs.some((t) => t.id === active)) setActive("info");
  }, [tabs, active]);

  useEffect(() => {
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
    const oracle =
      (displayCard ?? baseCard)?.oracle_id ??
      (displayCard ?? baseCard)?.id ??
      id;
    void fetchRulings(id, oracle).then(({ rulings: list, error: err }) => {
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
        shiftVertical(-1);
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        shiftVertical(1);
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

  // Mobile back and Escape are handled by the overlay manager (via Modal).
  // Desktop mouse back/forward moves cards.
  useEffect(() => {
    if (isMobile) return;
    function onMouseButton(e: MouseEvent) {
      if (e.button !== 3 && e.button !== 4) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.button === 3 && hasPrev && onPrev) onPrev();
      if (e.button === 4 && hasNext && onNext) onNext();
    }
    window.addEventListener("mouseup", onMouseButton, true);
    window.addEventListener("auxclick", onMouseButton, true);
    return () => {
      window.removeEventListener("mouseup", onMouseButton, true);
      window.removeEventListener("auxclick", onMouseButton, true);
    };
  }, [isMobile, hasPrev, hasNext, onPrev, onNext]);

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

  function handleRemove() {
    if (!deck) return;
    deck.onRemove();
    if (hasNext && onNext) onNext();
    else onClose();
  }

  function shiftVertical(dir: -1 | 1) {
    const tab = tabs[activeIndex];
    const subs = tab?.subTabs;
    if (subs && subs.length) {
      const cur = subByTab[tab.id] ?? subs[0].id;
      const idx = Math.max(0, subs.findIndex((s) => s.id === cur));
      const nextIdx = idx + dir;
      if (nextIdx >= 0 && nextIdx < subs.length) {
        setSub(tab.id, subs[nextIdx].id);
        return;
      }
    }
    const next = Math.min(tabs.length - 1, Math.max(0, activeIndex + dir));
    selectTab(tabs[next].id);
  }

  return (
    <Modal
      onClose={onClose}
      style={
        isMobile
          ? { width: "100%", height: "100%", maxWidth: "100%", maxHeight: "100%" }
          : {
              width: modalSize.w,
              height: modalSize.h,
              maxWidth: "none",
              maxHeight: "none",
            }
      }
    >
      <div
        className={styles.shell}
        ref={shellRef}
        style={{
          transform: `translate(${drag.x}px, ${drag.y}px)`,
          transition: dragging ? "none" : "transform 0.22s ease",
        }}
        onPointerDown={(e) => {
          const target = e.target as HTMLElement;
          if (target.closest("button, input, textarea, a, [role='button'], [data-panel-scroll]")) return;
          const top = shellRef.current?.getBoundingClientRect().top ?? 0;
          gesture.current = { x: e.clientX, y: e.clientY, fromTop: e.clientY - top < 56 };
          setDragging(true);
        }}
        onPointerMove={(e) => {
          const start = gesture.current;
          if (!start) return;
          const dx = e.clientX - start.x;
          const dy = e.clientY - start.y;
          if (Math.abs(dx) > Math.abs(dy)) setDrag({ x: dx, y: 0 });
          else if (start.fromTop && dy > 0) setDrag({ x: 0, y: dy });
          else setDrag({ x: 0, y: 0 });
        }}
        onPointerUp={(e) => {
          const start = gesture.current;
          gesture.current = null;
          setDragging(false);
          if (!start) return;
          const dx = e.clientX - start.x;
          const dy = e.clientY - start.y;
          setDrag({ x: 0, y: 0 });
          if (start.fromTop && dy > 110 && Math.abs(dy) > Math.abs(dx)) {
            onClose();
            return;
          }
          if (Math.abs(dx) > 90 && Math.abs(dx) > Math.abs(dy)) {
            if (dx < 0 && hasNext && onNext) onNext();
            if (dx > 0 && hasPrev && onPrev) onPrev();
          }
        }}
        onPointerCancel={() => {
          gesture.current = null;
          setDragging(false);
          setDrag({ x: 0, y: 0 });
        }}
      >
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
            <span className={styles.navHint}>←→ cards · Esc</span>
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
          <div className={`${styles.visual}${imageOpen ? "" : ` ${styles.visualCollapsed}`}`}>
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
                hideControls
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
            <button
              type="button"
              className={styles.collapseBtn}
              onClick={() => {
                const next = !imageOpen;
                setImageOpen(next);
                writeImageShown(next);
              }}
              aria-expanded={imageOpen}
              aria-label={imageOpen ? "Hide image" : "Show image"}
            >
              {imageOpen ? "⌃" : displayName}
            </button>
            {deck?.isOwner && (
              <div className={styles.quickQty}>
                <button type="button" className={styles.quickBtn} onClick={() => deck.onQty(-1)} aria-label="Decrease">
                  −
                </button>
                <span>{deck.card.quantity}</span>
                <button type="button" className={styles.quickBtn} onClick={() => deck.onQty(1)} aria-label="Increase">
                  +
                </button>
                <button type="button" className={`${styles.quickBtn} ${styles.quickRemove}`} onClick={deck.onRemove}>
                  Remove
                </button>
              </div>
            )}
          </div>

          <div className={styles.body}>
            <div className={styles.tabBar} role="tablist">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={t.id === active}
                  className={t.id === active ? styles.tabBtnOn : styles.tabBtn}
                  onClick={() => selectTab(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div
              key={contentKey}
              className={styles.tabPanel}
              role="tabpanel"
            >
              <div className={styles.tabPanelTitle}>
                <span>{activeTab?.label}</span>
                {activeTab?.titleExtra}
              </div>
              {activeTab?.subTabs && activeTab.subTabs.length > 0 && (
                <SubTabRail
                  subTabs={activeTab.subTabs}
                  active={subByTab[activeTab.id] ?? activeTab.subTabs[0].id}
                  onSelect={(id) => setSub(activeTab.id, id)}
                />
              )}

              {tabs.map((tab) => {
                if (!tab.keepMounted && tab.id !== active) return null;
                const subId = tab.subTabs
                  ? subByTab[tab.id] ?? tab.subTabs[0]?.id ?? null
                  : null;
                const hidden = tab.keepMounted && tab.id !== active;
                return (
                  <div
                    key={tab.id}
                    className={styles.panelScroll}
                    data-panel-scroll=""
                    hidden={hidden || undefined}
                    style={hidden ? { display: "none" } : undefined}
                  >
                    {tab.render(subId)}
                  </div>
                );
              })}
            </div>
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
