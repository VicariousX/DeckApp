import {
  DndContext,
  MeasuringStrategy,
  PointerSensor,
  TouchSensor,
  pointerWithin,
  closestCenter,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { getEventCoordinates } from "@dnd-kit/utilities";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type CSSProperties,
  type ReactNode,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { createPortal } from "react-dom";
import type { DeckBoard, DeckCard } from "../types/deck";
import styles from "../pages/DeckBuilderPage.module.css";
import { useStackHoverIndex } from "./StackCards";
import { lockBodyScroll } from "../lib/scrollLock";

export type DropTarget =
  | { kind: "card"; cardId: string }
  | { kind: "listcol"; board: DeckBoard; colId: string }
  | { kind: "listcol-new"; board: DeckBoard }
  | { kind: "board"; board: DeckBoard }
  | { kind: "group"; board: DeckBoard; groupKey: string };

export function cardDragId(cardId: string) {
  return `card:${cardId}`;
}

export function listColDropId(board: DeckBoard, colId: string) {
  return `listcol:${board}:${colId}`;
}

export function listColNewDropId(board: DeckBoard) {
  return `listcol-new:${board}`;
}

export function boardDropId(board: DeckBoard) {
  return `board:${board}`;
}

export function groupDropId(board: DeckBoard, groupKey: string) {
  return `group:${board}:${groupKey}`;
}

export function parseDropId(id: string | null | undefined): DropTarget | null {
  if (!id) return null;
  if (id.startsWith("card:")) {
    return { kind: "card", cardId: id.slice(5) };
  }
  if (id.startsWith("listcol-new:")) {
    return {
      kind: "listcol-new",
      board: id.slice("listcol-new:".length) as DeckBoard,
    };
  }
  if (id.startsWith("listcol:")) {
    const rest = id.slice("listcol:".length);
    const i = rest.indexOf(":");
    if (i < 0) return null;
    return {
      kind: "listcol",
      board: rest.slice(0, i) as DeckBoard,
      colId: rest.slice(i + 1),
    };
  }
  if (id.startsWith("board:")) {
    return { kind: "board", board: id.slice(6) as DeckBoard };
  }
  if (id.startsWith("group:")) {
    const rest = id.slice("group:".length);
    const i = rest.indexOf(":");
    if (i < 0) return null;
    return {
      kind: "group",
      board: rest.slice(0, i) as DeckBoard,
      groupKey: rest.slice(i + 1),
    };
  }
  return null;
}

/** Prefer cards, then list columns / new-column, then groups/boards. */
const deckCollision: CollisionDetection = (args) => {
  const pointerHits = pointerWithin(args);
  if (pointerHits.length > 0) {
    const id = (h: { id: string | number }) => String(h.id);
    const listCols = pointerHits.filter(
      (h) => id(h).startsWith("listcol:") && !id(h).startsWith("listcol-new:")
    );
    if (listCols.length > 0) return listCols;
    const boards = pointerHits.filter((h) => id(h).startsWith("board:"));
    if (boards.length > 0) return boards;
    const cards = pointerHits.filter((h) => id(h).startsWith("card:"));
    if (cards.length > 0) return cards;
    const listNew = pointerHits.filter((h) => id(h).startsWith("listcol-new:"));
    if (listNew.length > 0) return listNew;
    const groups = pointerHits.filter((h) => id(h).startsWith("group:"));
    if (groups.length > 0) return groups;
    return pointerHits;
  }
  return closestCenter(args);
};

export type MobileDropZone = {
  id: string;
  label: string;
  group: string;
};

type ImageDndProviderProps = {
  enabled: boolean;
  isMobile?: boolean;
  mobileZones?: MobileDropZone[];
  onDragCardStart?: (cardId: string) => void;
  onDragCardEnd?: () => void;
  onDropCard: (sourceCardId: string, target: DropTarget) => void;
  children: ReactNode;
  renderOverlay?: (cardId: string) => ReactNode;
};

const ImageDndOverContext = createContext<string | null>(null);
const ImageDndMobileContext = createContext(false);

export function useImageDndOverId() {
  return useContext(ImageDndOverContext);
}

export function ImageDndProvider({
  enabled,
  isMobile = false,
  mobileZones = [],
  onDragCardStart,
  onDragCardEnd,
  onDropCard,
  children,
  renderOverlay,
}: ImageDndProviderProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  // Viewport-fixed overlay position (client coordinates) — immune to page scroll
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);
  const [grabOffset, setGrabOffset] = useState({ x: 0, y: 0 });
  const [zoneAnchor, setZoneAnchor] = useState<"top" | "bottom">("bottom");

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: isMobile
        ? { delay: 380, tolerance: 12 }
        : { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 380, tolerance: 12 },
    })
  );

  // While dragging on mobile: don't scroll the page
  useEffect(() => {
    if (!activeId || !isMobile) return;
    const unlock = lockBodyScroll();
    function block(e: TouchEvent) {
      e.preventDefault();
    }
    window.addEventListener("touchmove", block, { passive: false });
    return () => {
      unlock();
      window.removeEventListener("touchmove", block);
    };
  }, [activeId, isMobile]);

  // Track pointer in viewport coords for the entire drag
  useEffect(() => {
    if (!activeId) return;

    function onMove(e: PointerEvent) {
      setPointer({ x: e.clientX, y: e.clientY });
    }
    function onUp() {
      setPointer(null);
    }

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerup", onUp, { passive: true });
    window.addEventListener("pointercancel", onUp, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [activeId]);

  function handleDragStart(e: DragStartEvent) {
    const id = String(e.active.id);
    if (!id.startsWith("card:")) return;

    const coords = e.activatorEvent
      ? getEventCoordinates(e.activatorEvent)
      : null;
    const rect = e.active.rect.current.initial;

    if (coords && rect) {
      setGrabOffset({
        x: coords.x - rect.left,
        y: coords.y - rect.top,
      });
      setPointer({ x: coords.x, y: coords.y });
    } else if (coords) {
      setGrabOffset({ x: 40, y: 40 });
      setPointer({ x: coords.x, y: coords.y });
    }

    setActiveId(id.slice(5));
    if (coords) {
      setZoneAnchor(coords.y < window.innerHeight / 2 ? "bottom" : "top");
    }
    onDragCardStart?.(id.slice(5));
  }

  function handleDragOver(e: DragOverEvent) {
    setOverId(e.over ? String(e.over.id) : null);
  }

  function handleDragEnd(e: DragEndEvent) {
    const active = String(e.active.id);
    const over = e.over ? String(e.over.id) : null;
    setActiveId(null);
    setOverId(null);
    setPointer(null);
    onDragCardEnd?.();
    if (!active.startsWith("card:") || !over) return;
    const sourceId = active.slice(5);
    const target = parseDropId(over);
    if (!target) return;
    if (target.kind === "card" && target.cardId === sourceId) return;
    onDropCard(sourceId, target);
  }

  function handleDragCancel() {
    setActiveId(null);
    setOverId(null);
    setPointer(null);
    onDragCardEnd?.();
  }

  if (!enabled) {
    return <>{children}</>;
  }

  const overlay =
    activeId && renderOverlay && pointer
      ? createPortal(
          <div
            className={`${styles.dndOverlay}${isMobile ? ` ${styles.dndOverlayOrb}` : ""}`}
            style={{
              position: "fixed",
              left: isMobile ? pointer.x - 36 : pointer.x - grabOffset.x,
              top: isMobile ? pointer.y - 36 : pointer.y - grabOffset.y,
              zIndex: 10000,
              pointerEvents: "none",
              margin: 0,
            }}
          >
            {renderOverlay(activeId)}
          </div>,
          document.body
        )
      : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={deckCollision}
      measuring={{
        droppable: { strategy: MeasuringStrategy.Always },
      }}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <ImageDndOverContext.Provider value={overId}>
      <ImageDndMobileContext.Provider value={isMobile}>
        {children}
        {isMobile && activeId && mobileZones.length > 0 &&
          createPortal(
            <div
              className={`${styles.mobileDropBar} ${
                zoneAnchor === "top" ? styles.mobileDropBarTop : styles.mobileDropBarBottom
              }`}
            >
              {Array.from(new Set(mobileZones.map((z) => z.group))).map((group) => (
                <div key={group} className={styles.mobileDropGroup}>
                  <div className={styles.mobileDropGroupLabel}>{group}</div>
                  <div className={styles.mobileDropRow}>
                    {mobileZones
                      .filter((z) => z.group === group)
                      .map((z) => (
                        <DroppableRegion
                          key={z.id}
                          id={z.id}
                          className={styles.mobileDropZone}
                          activeClassName={styles.mobileDropZoneActive}
                        >
                          {z.label}
                        </DroppableRegion>
                      ))}
                  </div>
                </div>
              ))}
            </div>,
            document.body
          )}
      </ImageDndMobileContext.Provider>
      </ImageDndOverContext.Provider>
      {overlay}
    </DndContext>
  );
}

type DraggableCardProps = {
  card: DeckCard;
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
  onClick?: (e: ReactMouseEvent<HTMLDivElement>) => void;
  onContextMenu?: (e: ReactMouseEvent) => void;
  /** Index within its StackCards (0 = back of stack). */
  stackIndex?: number;
};

export function DraggableStackCard({
  card,
  disabled,
  className,
  style,
  children,
  onClick,
  onContextMenu,
  stackIndex,
}: DraggableCardProps) {
  const hoverIdx = useStackHoverIndex();
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: cardDragId(card.id),
    data: { type: "card", cardId: card.id, board: card.board },
    disabled: Boolean(disabled),
  });

  const mobileDrag = useContext(ImageDndMobileContext);
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: cardDragId(card.id),
    data: { type: "card", cardId: card.id, board: card.board },
    disabled: Boolean(disabled) || mobileDrag,
  });

  function setRefs(node: HTMLElement | null) {
    setNodeRef(node);
    setDropRef(node);
  }

  // Cards in front of the hovered card shift down by a full card height
  const revealShift =
    !isDragging &&
    hoverIdx != null &&
    stackIndex != null &&
    stackIndex > hoverIdx;

  const isRevealed =
    hoverIdx != null && stackIndex != null && stackIndex === hoverIdx;

  const dragStyle: CSSProperties = {
    ...style,
    opacity: isDragging ? 0.25 : undefined,
    cursor: disabled ? undefined : isDragging ? "grabbing" : "grab",
    zIndex: isDragging ? 1 : style?.zIndex,
    touchAction: mobileDrag ? "pan-y" : "none",
    transform: revealShift
      ? "translateY(var(--stack-reveal))"
      : style?.transform,
    transition: isDragging
      ? "none"
      : "transform 0.12s ease-out, box-shadow 0.12s ease",
  };

  return (
    <div
      ref={setRefs}
      data-stack-idx={stackIndex}
      className={`${className ?? ""}${
        isOver && !isDragging ? ` ${styles.stackCardDropTarget}` : ""
      }${isDragging ? ` ${styles.stackCardDragging}` : ""}${
        isRevealed ? ` ${styles.stackCardRevealed}` : ""
      }`}
      style={dragStyle}
      onClick={onClick}
      onContextMenu={onContextMenu}
      {...listeners}
      {...attributes}
    >
      {children}
    </div>
  );
}

type DroppableProps = {
  id: string;
  className?: string;
  activeClassName?: string;
  children: ReactNode;
  disabled?: boolean;
  dataBoard?: DeckBoard;
};

export function DroppableRegion({
  id,
  className,
  activeClassName,
  children,
  disabled,
  dataBoard,
}: DroppableProps) {
  const { setNodeRef, isOver } = useDroppable({
    id,
    disabled: Boolean(disabled),
  });
  const overId = useImageDndOverId();
  const active = isOver || overId === id;

  return (
    <div
      ref={setNodeRef}
      data-board={dataBoard}
      data-board-zone={dataBoard ? "" : undefined}
      className={`${className ?? ""}${
        active && activeClassName ? ` ${activeClassName}` : ""
      }`}
    >
      {children}
    </div>
  );
}

export function stopDndPropagation(e: ReactMouseEvent) {
  e.stopPropagation();
}
