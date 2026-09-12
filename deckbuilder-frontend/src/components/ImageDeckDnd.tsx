import {
  DndContext,
  MeasuringStrategy,
  PointerSensor,
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

/** Prefer cards under the pointer; fall back to columns/boards; then closest center. */
const deckCollision: CollisionDetection = (args) => {
  const pointerHits = pointerWithin(args);
  if (pointerHits.length > 0) {
    const cards = pointerHits.filter((h) => String(h.id).startsWith("card:"));
    if (cards.length > 0) return cards;
    return pointerHits;
  }
  return closestCenter(args);
};

type ImageDndProviderProps = {
  enabled: boolean;
  onDragCardStart?: (cardId: string) => void;
  onDragCardEnd?: () => void;
  onDropCard: (sourceCardId: string, target: DropTarget) => void;
  children: ReactNode;
  renderOverlay?: (cardId: string) => ReactNode;
};

const ImageDndOverContext = createContext<string | null>(null);

export function useImageDndOverId() {
  return useContext(ImageDndOverContext);
}

export function ImageDndProvider({
  enabled,
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

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

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
            className={styles.dndOverlay}
            style={{
              position: "fixed",
              left: pointer.x - grabOffset.x,
              top: pointer.y - grabOffset.y,
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
        {children}
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
  onClick?: () => void;
};

export function DraggableStackCard({
  card,
  disabled,
  className,
  style,
  children,
  onClick,
}: DraggableCardProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: cardDragId(card.id),
    data: { type: "card", cardId: card.id, board: card.board },
    disabled: Boolean(disabled),
  });

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: cardDragId(card.id),
    data: { type: "card", cardId: card.id, board: card.board },
    disabled: Boolean(disabled),
  });

  function setRefs(node: HTMLElement | null) {
    setNodeRef(node);
    setDropRef(node);
  }

  const dragStyle: CSSProperties = {
    ...style,
    opacity: isDragging ? 0.25 : undefined,
    cursor: disabled ? undefined : isDragging ? "grabbing" : "grab",
    zIndex: isDragging ? 1 : style?.zIndex,
    touchAction: "none",
  };

  return (
    <div
      ref={setRefs}
      className={`${className ?? ""}${
        isOver && !isDragging ? ` ${styles.stackCardDropTarget}` : ""
      }${isDragging ? ` ${styles.stackCardDragging}` : ""}`}
      style={dragStyle}
      onClick={onClick}
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
