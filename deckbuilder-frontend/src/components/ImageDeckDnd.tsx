import {
  DndContext,
  DragOverlay,
  MeasuringStrategy,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import {
  createContext,
  useContext,
  useState,
  type CSSProperties,
  type ReactNode,
  type MouseEvent as ReactMouseEvent,
} from "react";
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

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  function handleDragStart(e: DragStartEvent) {
    const id = String(e.active.id);
    if (!id.startsWith("card:")) return;
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
    onDragCardEnd?.();
  }

  if (!enabled) {
    return <>{children}</>;
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      // Re-measure droppables while dragging so scroll/layout shifts stay accurate
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
      <DragOverlay dropAnimation={null} zIndex={10000}>
        {activeId && renderOverlay ? (
          <div className={styles.dndOverlay}>{renderOverlay(activeId)}</div>
        ) : null}
      </DragOverlay>
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
  // Source node stays in place; only the DragOverlay moves under the cursor.
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: cardDragId(card.id),
    data: { type: "card", cardId: card.id, board: card.board },
    disabled: Boolean(disabled),
  });

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: cardDragId(card.id),
    data: { type: "card", cardId: card.id },
    disabled: Boolean(disabled),
  });

  function setRefs(node: HTMLElement | null) {
    setNodeRef(node);
    setDropRef(node);
  }

  const dragStyle: CSSProperties = {
    ...style,
    // Do NOT apply dnd-kit transform here — that fights DragOverlay and
    // causes cursor misalignment once the page has been scrolled.
    opacity: isDragging ? 0.3 : undefined,
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

/** Stop control clicks from bubbling into the draggable listeners. */
export function stopDndPropagation(e: ReactMouseEvent) {
  e.stopPropagation();
}
