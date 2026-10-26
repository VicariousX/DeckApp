import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";

import type { ScryfallCard } from "../types/scryfallCard";
import { getFaces, isMultiCard } from "../utils/scryfall";
import { useDisplayCards } from "../hooks/useUserCardArt";
import type { CardFaceView } from "./CardImage";

import styles from "./CardResult.module.css";
import { CardEnlargeOverlay, CardImage } from "./CardImage";
import { CardTileField } from "./CardTile";
import { CardInspectorModal } from "./CardInspectorModal";
import { pushOverlayEntry } from "../lib/overlayManager";
import { useIsMobile } from "../hooks/useIsMobile";
import {
  CardContextMenu,
  modalJumpFromState,
  initialTabFromJump,
  type ModalJump,
} from "./CardContextMenu";
import { getFaceImage } from "../utils/scryfall";

type CardResultProps = {
  cards: ScryfallCard[];
  cardSize?: number;
  columns?: number;
  viewMode?: "image" | "text";
  browseMode?: "catalog" | "scroll";
  previewFirst?: boolean;
  onAddToDeck?: (card: ScryfallCard) => void;
  countInDeck?: (card: ScryfallCard) => number;
  onUndoAdd?: (card: ScryfallCard) => void;
  onReachEnd?: () => void;
  onReachStart?: () => void;
  onEnterScroll?: () => void;
  onExitScroll?: () => void;
  presenceOnly?: boolean;
  scrollStartIndex?: number;
  /** When set, catalog mode renders this instead of the default result card. */
  catalogTile?: (
    card: ScryfallCard,
    index: number,
    open: () => void,
    onContext: (e: { preventDefault: () => void; clientX: number; clientY: number }) => void
  ) => ReactNode;
};

function ResultCard({
  display,
  originalId,
  onSelect,
  onContext,
  onAddToDeck,
}: {
  display: ScryfallCard;
  originalId: string;
  onSelect: (card: ScryfallCard) => void;
  onContext: (e: { preventDefault: () => void; clientX: number; clientY: number }) => void;
  onAddToDeck?: (card: ScryfallCard) => void;
}) {
  const faces = getFaces(display);
  const [view, setView] = useState<CardFaceView>("front");
  const expanded = view === "both";

  return (
    <div
      className={`${styles.cardWrapper} ${
        expanded ? styles.cardWrapperExpanded : ""
      }`}
      onContextMenu={(e) => {
        e.preventDefault();
        onContext(e);
      }}
    >
      <CardImage
        card={display}
        onActivate={onSelect}
        onViewChange={setView}
      />

      <div className={styles.cardName}>
        {faces[0].name}
        {isMultiCard(display) && (
          <span className={styles.cardNameMuted}> · DFC</span>
        )}
      </div>

      <div className={styles.cardActions}>
        {onAddToDeck && (
          <button
            type="button"
            className={styles.addDeckBtn}
            onClick={(e) => {
              e.stopPropagation();
              onAddToDeck(display);
            }}
          >
            Add to deck
          </button>
        )}
        <Link
          to={`/card/${originalId}`}
          className={styles.cardPageMiniLink}
          onClick={(e) => e.stopPropagation()}
        >
          Card page
        </Link>
      </div>
    </div>
  );
}

export function CardResult({
  cards,
  cardSize = 240,
  columns,
  viewMode = "image",
  browseMode = "catalog",
  previewFirst = false,
  onAddToDeck,
  countInDeck,
  onUndoAdd,
  onReachEnd,
  onReachStart,
  onEnterScroll,
  onExitScroll,
  presenceOnly = false,
  scrollStartIndex = 0,
  catalogTile,
}: CardResultProps) {
  const isMobile = useIsMobile();
  const { pairs } = useDisplayCards(cards);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [previewMode, setPreviewMode] = useState<"swipe" | "tilt">("swipe");
  const [rightAction, setRightAction] = useState<"open" | "add">("open");
  const pendingPage = useRef<"next" | "prev" | null>(null);
  const [enterFrom, setEnterFrom] = useState<"up" | "down" | null>(null);
  const stableId = useRef<string | null>(null);
  const [optimisticQty, setOptimisticQty] = useState<Record<string, number>>({});
  const [addedToast, setAddedToast] = useState<{
    name: string;
    count: number;
    card: ScryfallCard;
    kind: "added" | "removed";
  } | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [modalJump, setModalJump] = useState<ModalJump>("info");
  const [ctx, setCtx] = useState<{ x: number; y: number; index: number } | null>(
    null
  );

  useEffect(() => {
    if (!addedToast) return;
    const t = window.setTimeout(() => setAddedToast(null), 700);
    return () => window.clearTimeout(t);
  }, [addedToast]);

  const list = useMemo(
    () =>
      pairs.map(({ original, display, resolved }) => ({
        originalId: original.id,
        display,
        hidePrintingMeta:
          resolved.has_custom_art || resolved.has_preferred_printing,
      })),
    [pairs]
  );

  // Keep the same card in view when the list is prepended/appended (continuous scroll).
  useEffect(() => {
    if (browseMode !== "scroll" || !list.length || !stableId.current) return;
    const at = list.findIndex((c) => c.originalId === stableId.current);
    if (at >= 0 && at !== previewIndex) {
      setPreviewIndex(at);
    }
  }, [list, browseMode]); // intentionally not depending on previewIndex

  // Advance once after a page load that was requested from the end/start.
  useEffect(() => {
    if (!pendingPage.current || !list.length) return;
    const pending = pendingPage.current;
    pendingPage.current = null;
    const currentAt = stableId.current
      ? list.findIndex((c) => c.originalId === stableId.current)
      : previewIndex ?? 0;
    if (currentAt < 0) return;
    if (pending === "next" && currentAt < list.length - 1) {
      setEnterFrom("up");
      const next = currentAt + 1;
      setPreviewIndex(next);
      stableId.current = list[next]?.originalId ?? null;
      return;
    }
    if (pending === "prev" && currentAt > 0) {
      setEnterFrom("down");
      const prev = currentAt - 1;
      setPreviewIndex(prev);
      stableId.current = list[prev]?.originalId ?? null;
    }
  }, [list, browseMode]); // run on list change; previewIndex not needed

  const openedScroll = useRef(false);
  const pendingStartId = useRef<string | null>(null);
  const exitRef = useRef(onExitScroll);
  exitRef.current = onExitScroll;
  useEffect(() => {
    if (browseMode !== "scroll") return;
    return pushOverlayEntry({
      type: "scroll",
      close: () => exitRef.current?.(),
    }).release;
  }, [browseMode]);
  useEffect(() => {
    if (browseMode !== "scroll" || viewMode !== "image") {
      openedScroll.current = false;
      if (browseMode !== "scroll") setPreviewIndex(null);
      return;
    }
    if (openedScroll.current || !list.length) return;
    openedScroll.current = true;
    setPreviewMode("swipe");
    const wanted = pendingStartId.current;
    pendingStartId.current = null;
    const found = wanted ? list.findIndex((item) => item.originalId === wanted || item.display.id === wanted) : -1;
    const start = found >= 0 ? found : Math.min(Math.max(0, scrollStartIndex), list.length - 1);
    setPreviewIndex(start);
    stableId.current = list[start]?.originalId ?? null;
  }, [browseMode, viewMode, list.length, scrollStartIndex]);

  useEffect(() => {
    if (browseMode !== "scroll" || previewIndex == null) return;
    const index = previewIndex;
    let lock = false;
    function go(delta: number) {
      if (lock) return;
      lock = true;
      window.setTimeout(() => {
        lock = false;
      }, 220);
      setPreviewIndex((cur) => {
        if (cur == null) return cur;
        const next = cur + delta;
        if (next >= 0 && next < list.length) {
          stableId.current = list[next]?.originalId ?? null;
          return next;
        }
        if (delta > 0) onReachEnd?.();
        if (delta < 0) onReachStart?.();
        return cur;
      });
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        go(e.key === "ArrowDown" ? 1 : -1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        const card = list[index]?.display;
        if (card) onAddToDeck?.(card);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        const card = list[index]?.display;
        if (card) onUndoAdd?.(card);
      } else if (e.key === "Escape") {
        onExitScroll?.();
      }
    }
    function onWheel(e: WheelEvent) {
      if (Math.abs(e.deltaY) < 8 && Math.abs(e.deltaX) < 8) return;
      e.preventDefault();
      const card = list[index]?.display;
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        if (!card) return;
        if (e.deltaX > 0) onAddToDeck?.(card);
        else onUndoAdd?.(card);
        return;
      }
      go(e.deltaY > 0 ? 1 : -1);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("wheel", onWheel);
    };
  }, [browseMode, previewIndex, list, onAddToDeck, onUndoAdd, onExitScroll, onReachEnd, onReachStart]);

  if (cards.length === 0) {
    return null;
  }

  const gridStyle = {
    "--card-min": `${cardSize}px`,
    ...(columns ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` } : {}),
  } as CSSProperties;

  const selected =
    selectedIndex != null && selectedIndex >= 0 && selectedIndex < list.length
      ? list[selectedIndex]
      : null;

  const preview =
    previewIndex != null && previewIndex >= 0 && previewIndex < list.length
      ? list[previewIndex]
      : null;

  return (
    <>
      {viewMode === "text" ? (
        <ul className={styles.textList}>
          {list.map((item, i) => (
            <li key={item.originalId}>
              <div className={styles.textRowWrap}>
              <button
                type="button"
                className={styles.textRow}
                onClick={() => setSelectedIndex(i)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setCtx({ x: e.clientX, y: e.clientY, index: i });
                }}
              >
                <span className={styles.textName}>{item.display.name}</span>
                <span className={styles.textType}>{item.display.type_line}</span>
              </button>
              {onAddToDeck && (
                <button
                  type="button"
                  className={styles.addDeckBtn}
                  onClick={() => onAddToDeck(item.display)}
                >
                  Add
                </button>
              )}
              </div>
            </li>
          ))}
        </ul>
      ) : browseMode === "scroll" ? null : catalogTile ? (
        <CardTileField>
          <div className={styles.resultsGrid} style={gridStyle}>
            {list.map((item, i) => (
              <div key={item.originalId}>
                {catalogTile(
                  item.display,
                  i,
                  () => setSelectedIndex(i),
                  (e) => setCtx({ x: e.clientX, y: e.clientY, index: i })
                )}
              </div>
            ))}
          </div>
        </CardTileField>
      ) : (
        <div
          className={styles.resultsGrid}
          style={gridStyle}
        >
          {list.map((item, i) => (
            <ResultCard
              key={item.originalId}
              display={item.display}
              originalId={item.originalId}
              onSelect={() => {
                if (isMobile && browseMode === "catalog") {
                  const x = Math.min(window.innerWidth - 220, window.innerWidth / 2);
                  const y = Math.min(window.innerHeight - 280, window.innerHeight / 2);
                  setCtx({ x, y, index: i });
                  return;
                }
                setSelectedIndex(i);
              }}
              onContext={(e) =>
                setCtx({ x: e.clientX, y: e.clientY, index: i })
              }
              onAddToDeck={onAddToDeck}
            />
          ))}
        </div>
      )}

      {browseMode === "scroll" && preview && previewIndex != null && createPortal(
        <div
          className={styles.scrollStage}
          onPointerDown={(e) => {
            if (e.target === e.currentTarget) onExitScroll?.();
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) onExitScroll?.();
          }}
        >
          <button
            type="button"
            className={styles.scrollExit}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onExitScroll?.();
            }}
          >
            ×
          </button>
        <CardEnlargeOverlay
          embedded
          frontSrc={getFaceImage(preview.display, 0)}
          backSrc={getFaceImage(preview.display, 1) || ""}
          frontName={preview.display.name}
          backName={preview.display.card_faces?.[1]?.name ?? "Back"}
          multi={isMultiCard(preview.display)}
          mode={previewMode}
          onClose={() => {
            setPreviewIndex(null);
            stableId.current = null;
          }}
          enterFrom={enterFrom}
          onEntered={() => setEnterFrom(null)}
          onSwipeRight={() => {
            if (!onAddToDeck) return;
            const id = preview.display.oracle_id || preview.display.id;
            const count = (optimisticQty[id] ?? countInDeck?.(preview.display) ?? 0) + 1;
            setOptimisticQty((m) => ({ ...m, [id]: count }));
            onAddToDeck(preview.display);
            setAddedToast({ name: preview.display.name, count, card: preview.display, kind: "added" });
          }}
          keepOpenOnRight
          nextSrc={
            previewIndex < list.length - 1
              ? getFaceImage(list[previewIndex + 1].display, 0)
              : undefined
          }
          prevSrc={
            previewIndex > 0
              ? getFaceImage(list[previewIndex - 1].display, 0)
              : undefined
          }
          onSwipeUp={() => {
            if (previewIndex < list.length - 1) {
              const next = previewIndex + 1;
              setPreviewIndex(next);
              stableId.current = list[next]?.originalId ?? null;
              return;
            }
            if (onReachEnd) {
              pendingPage.current = "next";
              onReachEnd();
            }
          }}
          onSwipeDown={() => {
            if (previewIndex > 0) {
              const prev = previewIndex - 1;
              setPreviewIndex(prev);
              stableId.current = list[prev]?.originalId ?? null;
              return;
            }
            if (onReachStart) {
              pendingPage.current = "prev";
              onReachStart();
            }
          }}
          rightLabel="Add"
          leftLabel={((optimisticQty[preview.display.oracle_id || preview.display.id] ?? countInDeck?.(preview.display)) ?? 0) > 0 ? "−1" : ""}
          toast={addedToast ? (addedToast.kind === "removed" ? "Card removed" : "Card added") : null}
          addedQty={optimisticQty[preview.display.oracle_id || preview.display.id] ?? countInDeck?.(preview.display) ?? 0}
          presenceOnly={presenceOnly}
          onActivate={() => setSelectedIndex(previewIndex)}
          onLongPress={() => {
            setCtx({
              x: Math.min(window.innerWidth - 220, window.innerWidth / 2),
              y: Math.min(window.innerHeight - 280, window.innerHeight / 3),
              index: previewIndex,
            });
          }}
          onSwipeLeft={() => {
            const id = preview.display.oracle_id || preview.display.id;
            const count = optimisticQty[id] ?? countInDeck?.(preview.display) ?? 0;
            if (count <= 0 || !onUndoAdd) return;
            setOptimisticQty((m) => ({ ...m, [id]: count - 1 }));
            onUndoAdd(preview.display);
            setAddedToast({
              name: preview.display.name,
              count: count - 1,
              card: preview.display,
              kind: "removed",
            });
          }}
          hint="Swipe right to add · left to remove · up/down next card · tap for details"
        />
        </div>,
        document.body
      )}

      {ctx && list[ctx.index] && (
        <CardContextMenu
          onStartScroll={() => {
            const item = list[ctx.index];
            pendingStartId.current = item?.originalId ?? item?.display.id ?? null;
            setPreviewIndex(ctx.index);
            stableId.current = item?.originalId ?? null;
            onEnterScroll?.();
          }}
          x={ctx.x}
          y={ctx.y}
          target={{
            scryfallId: list[ctx.index].originalId,
            oracleId: list[ctx.index].display.oracle_id,
            name: list[ctx.index].display.name,
            typeLine: list[ctx.index].display.type_line,
            imageUrl: getFaceImage(list[ctx.index].display, 0),
            imageUrlBack: getFaceImage(list[ctx.index].display, 1) || undefined,
          }}
          onClose={() => setCtx(null)}
          onEnhance={() => {
            setPreviewMode("tilt");
            setPreviewIndex(ctx.index);
            stableId.current = list[ctx.index]?.originalId ?? null;
            setCtx(null);
          }}
          onOpenModal={(jump) => {
            setModalJump(jump);
            setSelectedIndex(ctx.index);
          }}
        />
      )}

      {selected && selectedIndex != null && (
        <CardInspectorModal
          key={selected.originalId}
          initialTab={initialTabFromJump(modalJump)}
          initialInfoSub={modalJump === "info:rulings" ? "rulings" : "details"}
          initialArtSub={modalJump === "artwork:upload" ? "upload" : "prints"}
          onTabChange={(tab, infoSub, artSub) =>
            setModalJump(modalJumpFromState(tab, infoSub, artSub))
          }
          scryfallId={selected.originalId}
          name={selected.display.name}
          onClose={() => setSelectedIndex(null)}
          hasPrev={selectedIndex > 0}
          hasNext={selectedIndex < list.length - 1}
          onPrev={() => setSelectedIndex((i) => (i != null && i > 0 ? i - 1 : i))}
          onNext={() =>
            setSelectedIndex((i) =>
              i != null && i < list.length - 1 ? i + 1 : i
            )
          }
        />
      )}
    </>
  );
}
