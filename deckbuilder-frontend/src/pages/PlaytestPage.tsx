import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type Ref,
} from "react";
import { Link, useParams } from "react-router-dom";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useAuth } from "../auth/AuthProvider";
import { fetchDeckDetail } from "../services/deckService";
import { fetchCollectionByIds, fetchNamedCard } from "../lib/scryfallApi";
import { getFaceImage } from "../utils/scryfall";
import { useArtPreferences } from "../auth/ArtPreferencesProvider";
import { loadDeckTokens } from "../lib/deck/deckTokens";
import { TiltFace } from "../components/CardImage";
import { RateLimitedImg } from "../components/RateLimitedImg";
import { CardInspectorModal } from "../components/CardInspectorModal";
import {
  cardImage,
  createTableFromDeck,
  reducePlay,
} from "../lib/playtest/engine";
import { usePlayInteraction } from "../lib/playtest/interaction";
import {
  DEFAULT_PLAY_SETTINGS,
  clearLiveTable,
  loadLiveTable,
  loadJournal,
  loadPlaySettings,
  saveLiveTable,
  saveJournal,
  savePlaySettings,
  type PlaySettings,
} from "../lib/playtest/settings";
import { acceptIntent, openHostedTable, publishTable, type TableWire } from "../lib/playtest/sync";
import { deadCreatures, legendClashes, suggestLandTaps } from "../lib/playtest/assistants";
import { emptyJournal, project, recordAction, replayJournal, truncateJournal } from "../lib/playtest/view";
import type { PlayAction, PlayCard, PlayZone, TableJournal, TableState } from "../lib/playtest/types";
import transitions from "../styles/pageTransitions.module.css";
import styles from "./PlaytestPage.module.css";

const MOVE_ZONES: { id: PlayZone; label: string }[] = [
  { id: "battlefield", label: "Battlefield" },
  { id: "hand", label: "Hand" },
  { id: "graveyard", label: "Graveyard" },
  { id: "exile", label: "Exile" },
  { id: "library", label: "Library" },
  { id: "command", label: "Command" },
  { id: "sideboard", label: "Sideboard" },
  { id: "stack", label: "Stack" },
];

function manaValue(card: PlayCard): number {
  if (typeof card.cmc === "number") return card.cmc;
  const cost = card.manaCost || "";
  const nums = [...cost.matchAll(/\{(\d+)\}/g)].reduce((s, m) => s + Number(m[1]), 0);
  const pips = (cost.match(/\{[WUBRGC]\}/gi) || []).length;
  const hybrid = (cost.match(/\{[WUBRG2]\/[WUBRG]\}/gi) || []).length;
  return nums + pips + hybrid;
}

function roll(sides: number) {
  return 1 + Math.floor(Math.random() * sides);
}

function clampMenu(x: number, y: number, w = 220, h = 320) {
  const pad = 8;
  const maxW = Math.min(w, window.innerWidth - pad * 2);
  const maxH = Math.min(h, window.innerHeight * 0.72);
  const left = Math.min(window.innerWidth - maxW - pad, Math.max(pad, x));
  const top = Math.min(window.innerHeight - maxH - pad, Math.max(pad, y));
  const flyLeft = left + maxW + 168 > window.innerWidth;
  return { x: left, y: top, flyLeft };
}

function MenuBox({
  x,
  y,
  children,
}: {
  x: number;
  y: number;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    let left = x;
    let top = y;
    if (left + r.width > window.innerWidth - 8) left = window.innerWidth - r.width - 8;
    if (top + r.height > window.innerHeight - 8) top = window.innerHeight - r.height - 8;
    if (left < 8) left = 8;
    if (top < 8) top = 8;
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
  });
  return (
    <div ref={ref} className={styles.menu} style={{ left: x, top: y }} onClick={(e) => e.stopPropagation()}>
      {children}
    </div>
  );
}

function useHScroll() {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    function onWheel(e: WheelEvent) {
      if (!el) return;
      if (Math.abs(e.deltaY) < Math.abs(e.deltaX)) return;
      el.scrollLeft += e.deltaY;
      e.preventDefault();
    }
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);
  return ref;
}

function stepFromEvent(e: { shiftKey: boolean; ctrlKey: boolean; metaKey: boolean }) {
  if (e.shiftKey) return 10;
  if (e.ctrlKey || e.metaKey) return 5;
  return 1;
}

function bumpX(n: number, e: { shiftKey: boolean; ctrlKey: boolean; metaKey: boolean }, dir: 1 | -1) {
  return Math.max(1, n + dir * stepFromEvent(e));
}

function plusKey(card: PlayCard) {
  return /\bplaneswalker\b/i.test(card.typeLine) ? "loyalty" : "+1/+1";
}

function canHaveSickness(card: PlayCard) {
  return /\b(creature|vehicle)\b/i.test(card.typeLine || "");
}

function tokenStatus(card: PlayCard, turn: number): "sick" | "tapped" | "ready" {
  if (card.tapped) return "tapped";
  if (canHaveSickness(card) && (card.enteredTurn ?? turn) === turn) return "sick";
  return "ready";
}

function tokenStackKey(c: PlayCard, turn: number) {
  return `${c.oracleId || c.name}|${tokenStatus(c, turn)}|${c.facedown ? 1 : 0}|${JSON.stringify(c.counters)}`;
}

function groupFieldCards(cards: PlayCard[], turn: number) {
  const shown: { card: PlayCard; stack: PlayCard[]; status: "sick" | "tapped" | "ready" | "single" }[] = [];
  const used = new Set<string>();
  for (const c of cards) {
    if (used.has(c.instanceId)) continue;
    if (c.token && !c.tapped) {
      const key = tokenStackKey(c, turn);
      const stack = cards.filter((x) => x.token && !x.tapped && tokenStackKey(x, turn) === key);
      stack.forEach((x) => used.add(x.instanceId));
      shown.push({ card: c, stack, status: tokenStatus(c, turn) });
    } else {
      used.add(c.instanceId);
      shown.push({ card: c, stack: [c], status: c.token && c.tapped ? "tapped" : "single" });
    }
  }
  return shown;
}

function PlayFace({
  card,
  selected,
  onActivate,
  onMenu,
  onGrab,
  onHover,
  onDoubleClick,
  style,
  stackCount,
  onCounter,
  onStackDelta,
  status,
  ownerMark,
}: {
  card: PlayCard;
  selected: boolean;
  onActivate: (e: ReactMouseEvent) => void;
  onMenu: (e: ReactMouseEvent) => void;
  onGrab?: (e: ReactMouseEvent) => void;
  onHover?: (card: PlayCard | null) => void;
  onDoubleClick?: (e: ReactMouseEvent) => void;
  style?: CSSProperties;
  stackCount?: number;
  onCounter?: (key: string, delta: number, e: ReactMouseEvent) => void;
  onStackDelta?: (delta: number, e: ReactMouseEvent) => void;
  status?: "sick" | "tapped" | "ready" | "single";
  ownerMark?: string;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: card.instanceId,
    data: { card },
  });
  const src = cardImage(card);
  const dndPointerDown = listeners?.onPointerDown as ((e: { nativeEvent: Event }) => void) | undefined;
  const dndListeners = { ...(listeners ?? {}) } as Record<string, unknown>;
  delete dndListeners.onPointerDown;
  return (
    <button
      type="button"
      ref={setNodeRef}
      data-play-id={card.instanceId}
      className={`${styles.card}${card.tapped ? ` ${styles.tapped}` : ""}${
        selected ? ` ${styles.selected}` : ""
      }${status === "sick" ? ` ${styles.sick}` : ""}${isDragging ? ` ${styles.dragging}` : ""}`}
      style={{ ...style, opacity: isDragging ? 0.35 : style?.opacity }}
      onClick={(e) => {
        e.stopPropagation();
        onActivate(e);
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        onDoubleClick?.(e);
      }}
      onMouseEnter={() => onHover?.(card)}
      onMouseLeave={() => onHover?.(null)}
      onContextMenu={onMenu}
      onPointerDown={(e) => {
        onGrab?.(e as unknown as ReactMouseEvent);
        dndPointerDown?.(e);
      }}
      {...dndListeners}
      {...attributes}
    >
      <TiltFace enabled={!isDragging && !card.facedown}>
        {card.facedown ? (
          <span className={styles.sleeve} title="Facedown" />
        ) : src ? (
          <RateLimitedImg src={src} alt={card.name} className={styles.cardImg} />
        ) : (
          <span className={styles.cardFace}>{card.name}</span>
        )}
      </TiltFace>
      {onStackDelta ? (
        <button
          type="button"
          className={styles.stackBadge}
          title={status === "sick" ? "Summoning sick" : status === "tapped" ? "Tapped" : "Available"}
          onClick={(e) => {
            e.stopPropagation();
            onStackDelta(1, e);
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onStackDelta(-1, e);
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          ×{stackCount ?? 1}
        </button>
      ) : stackCount && stackCount > 1 ? (
        <span className={styles.stackBadge}>×{stackCount}</span>
      ) : null}
      {onCounter && !card.facedown && (/\bplaneswalker\b/i.test(card.typeLine) || card.counters["+1/+1"] != null) ? (
        <button
          type="button"
          className={styles.counterChip}
          onClick={(e) => {
            e.stopPropagation();
            onCounter(plusKey(card), 1, e);
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onCounter(plusKey(card), -1, e);
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {/\bplaneswalker\b/i.test(card.typeLine) ? "L" : "+"}
          {card.counters[plusKey(card)] ?? 0}
        </button>
      ) : null}
      {status === "sick" ? <span className={styles.statusTag}>sick</span> : null}
      {ownerMark ? <span className={styles.ownerPip} title={`Owned by ${ownerMark}`}>O:{ownerMark.slice(0, 1)}</span> : null}
    </button>
  );
}

function ZoneDrop({
  zone,
  row,
  className,
  children,
  innerRef,
  onPointerDown,
}: {
  zone: PlayZone;
  row?: "field" | "lands";
  className?: string;
  children: ReactNode;
  innerRef?: Ref<HTMLDivElement>;
  onPointerDown?: (e: ReactPointerEvent<HTMLDivElement>) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `zone:${zone}:${row ?? "any"}`,
    data: { zone, row },
  });
  return (
    <div
      ref={(node) => {
        setNodeRef(node);
        if (typeof innerRef === "function") innerRef(node);
        else if (innerRef && "current" in innerRef) (innerRef as { current: HTMLDivElement | null }).current = node;
      }}
      className={`${className ?? ""}${isOver ? ` ${styles.dropOver}` : ""}`}
      onPointerDown={onPointerDown}
    >
      {children}
    </div>
  );
}

export function PlaytestPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { resolveImageUrl } = useArtPreferences();
  const [table, setTable] = useState<TableState | null>(null);
  const history = useRef<TableState[]>([]);
  const journalRef = useRef<TableJournal | null>(null);
  const [fogSeats, setFogSeats] = useState(false);
  const [tapCost, setTapCost] = useState("");
  const [pendingTax, setPendingTax] = useState<PlayCard | null>(null);
  const [role, setRole] = useState<"solo" | "host" | "guest">("solo");
  const [roomCode, setRoomCode] = useState("");
  const [viewerSeat, setViewerSeat] = useState<string | null>(null);
  const channelRef = useRef<{ send: (msg: TableWire) => void; close: () => void } | null>(null);
  const roleRef = useRef(role);
  const viewerRef = useRef(viewerSeat);
  const remoteRef = useRef(false);
  roleRef.current = role;
  viewerRef.current = viewerSeat;
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const ix = usePlayInteraction();
  const {
    selected, setSelected, picked, setPicked,
    menu, setMenu, libMenu, setLibMenu, tableMenu, setTableMenu,
    branch, setBranch, enhanceList, setEnhanceList,
    hoverCard, setHoverCard, altPeek, setAltPeek,
    searchZone, setSearchZone, scryN, setScryN, lookKind, setLookKind,
    cascadeHit, setCascadeHit, marquee, setMarquee,
    libDestOpen, setLibDestOpen, moveOpen, setMoveOpen,
    lastClickRef, hoverRef, marqueeRef, targets, clearUi, clearSelection, openEnhance,
  } = ix;
  const [kit, setKit] = useState<null | { kind: "tokens" | "side" | "spawn"; tab: "tokens" | "side" | "spawn" }>(null);
  const [libX, setLibX] = useState(1);
  const [spawnQ, setSpawnQ] = useState("");
  const [inspect, setInspect] = useState<PlayCard | null>(null);
  const [filter, setFilter] = useState("");
  const [settings, setSettings] = useState<PlaySettings>(DEFAULT_PLAY_SETTINGS);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [countsOpen, setCountsOpen] = useState(false);
  const [countsLocked, setCountsLocked] = useState(false);
  const [coin, setCoin] = useState<string | null>(null);
  const [activeDrag, setActiveDrag] = useState<PlayCard | null>(null);
  const [libSlot, setLibSlot] = useState(1);
  const [logOpen, setLogOpen] = useState(false);
  const bfRef = useRef<HTMLDivElement | null>(null);
  const fieldRef = useRef<HTMLDivElement | null>(null);
  const ghostRef = useRef<HTMLSpanElement | null>(null);
  const ptrRef = useRef({ x: 0, y: 0 });
  const grabRef = useRef({ dx: 0, dy: 0, w: 76.8, h: 107.4 });
  const handScroll = useHScroll();
  const landScroll = useHScroll();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  useEffect(() => {
    setSettings(loadPlaySettings());
  }, []);

  const persist = useCallback((next: PlaySettings) => {
    setSettings(next);
    savePlaySettings(next);
  }, []);
  const xv = (n: number) => (settings.showXGlyph ? "X" : String(n));

  const dispatch = useCallback((action: PlayAction) => {
    setTable((cur) => {
      if (!cur && action.type !== "hydrate") return cur;
      if (roleRef.current === "guest" && !remoteRef.current && action.type !== "hydrate") {
        channelRef.current?.send({ kind: "intent", action, from: viewerRef.current ?? "guest" });
        return cur;
      }
      const base = action.type === "hydrate" ? action.state : cur!;
      if (action.type !== "hydrate") {
        history.current = [...history.current.slice(-39), cur!];
      }
      const next = reducePlay(base, action);
      if (action.type === "hydrate") {
        if (!journalRef.current) journalRef.current = emptyJournal(next);
      } else if (journalRef.current) {
        journalRef.current = recordAction(journalRef.current, action, next);
      } else {
        journalRef.current = recordAction(emptyJournal(base), action, next);
      }
      if (next.deckId) {
        saveLiveTable(next.deckId, next);
        if (journalRef.current) saveJournal(next.deckId, journalRef.current);
      }
      if (roleRef.current === "host" && action.type !== "hydrate") {
        channelRef.current?.send({ kind: "action", action, from: next.activeSeat, state: next });
        if ((journalRef.current?.seq ?? 0) % 25 === 0) {
          channelRef.current?.send({ kind: "snapshot", state: next, from: next.activeSeat });
        }
      }
      return next;
    });
  }, []);

  const start = useCallback(async (fresh = false) => {
    if (!id) return;
    setLoading(true);
    setError(null);
    const prefs = loadPlaySettings();
    if (!fresh) {
      const live = loadLiveTable(id);
      const journal = loadJournal(id);
      if (live?.started) {
        const replayed = journal ? replayJournal(journal) : null;
        const state = replayed ?? live;
        journalRef.current = journal ?? emptyJournal(state);
        dispatch({ type: "hydrate", state });
        setLoading(false);
        return;
      }
    } else {
      clearLiveTable(id);
      journalRef.current = null;
      history.current = [];
    }
    const { detail, error: err } = await fetchDeckDetail(id);
    if (err || !detail) {
      setError(err ?? "Deck not found");
      setLoading(false);
      return;
    }
    const ids = [...new Set(detail.cards.map((c) => c.scryfall_id).filter(Boolean))];
    const { cards } = await fetchCollectionByIds(ids);
    const images: Record<string, { front?: string; back?: string }> = {};
    for (const c of cards) {
      const oid = c.oracle_id || c.id;
      const front =
        (await resolveImageUrl(oid, c.id, 0)) || getFaceImage(c, 0) || undefined;
      const back =
        (await resolveImageUrl(oid, c.id, 1)) || getFaceImage(c, 1) || undefined;
      images[c.id] = { front, back };
    }
    const next = createTableFromDeck(detail, images, {
      userId: user?.id,
      name: user?.email || "You",
      openingHand: prefs.openingHand,
      startingLife: prefs.startingLife ?? undefined,
    });
    history.current = [];
    dispatch({ type: "hydrate", state: next });
    setLoading(false);
  }, [dispatch, id, resolveImageUrl, user]);

  const sendIntent = useCallback((action: PlayAction) => {
    if (roleRef.current !== "guest") {
      dispatch(action);
      return;
    }
    channelRef.current?.send({ kind: "intent", action, from: viewerSeat ?? "guest" });
  }, [dispatch, viewerSeat]);

  useEffect(() => {
    return () => channelRef.current?.close();
  }, []);

  useEffect(() => {
    void start();
  }, [start]);

  useEffect(() => {
    function close() {
      clearUi();
      if (!countsLocked) setCountsOpen(false);
    }
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [countsLocked, clearUi]);

  useEffect(() => {
    function move(e: PointerEvent) {
      ptrRef.current = { x: e.clientX, y: e.clientY };
    }
    window.addEventListener("pointermove", move);
    return () => window.removeEventListener("pointermove", move);
  }, []);

  useEffect(() => {
    if (!marquee) return;
    function onMove(e: PointerEvent) {
      const cur = marqueeRef.current;
      if (!cur) return;
      const next = { ...cur, x1: e.clientX, y1: e.clientY };
      marqueeRef.current = next;
      setMarquee(next);
    }
    function onUp() {
      const cur = marqueeRef.current;
      setMarquee(null);
      marqueeRef.current = null;
      if (!cur) return;
      const left = Math.min(cur.x0, cur.x1);
      const right = Math.max(cur.x0, cur.x1);
      const top = Math.min(cur.y0, cur.y1);
      const bottom = Math.max(cur.y0, cur.y1);
      if (right - left < 6 && bottom - top < 6) return;
      const ids: string[] = [];
      document.querySelectorAll("[data-play-id]").forEach((node) => {
        const r = node.getBoundingClientRect();
        if (r.right >= left && r.left <= right && r.bottom >= top && r.top <= bottom) {
          const id = (node as HTMLElement).dataset.playId;
          if (id) ids.push(id);
        }
      });
      if (ids.length) {
        setPicked(ids);
        setSelected(ids[0]);
      }
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [marquee ? 1 : 0]);

  useEffect(() => {
    function selectionIds(): string[] {
      if (!table) return [];
      const seat = table.seats[0];
      const hover = hoverRef.current;
      if (hover && picked.includes(hover.instanceId) && picked.length > 1) return picked;
      if (hover) return [hover.instanceId];
      if (selected && picked.includes(selected) && picked.length > 1) return picked;
      if (selected) return [selected];
      return [];
    }
    function onKey(e: KeyboardEvent) {
      if (!table) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const seat = table.seats[0];
      const ids = selectionIds();
      const key = e.key;
      if (key === "d" || key === "D") {
        dispatch({ type: "draw", seatId: seat.id, n: settings.drawCount });
      } else if (key === "n" || key === "N") {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          void start(true);
        } else {
          dispatch({ type: "nextTurn", untap: settings.nextTurnUntap, draw: settings.nextTurnDraw });
        }
      } else if (key === "u" || key === "U") {
        dispatch({ type: "untapAll", seatId: seat.id });
      } else if ((key === "z" || key === "Z") && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        const prev = history.current.pop();
        if (prev) {
          if (journalRef.current) journalRef.current = truncateJournal(journalRef.current, prev);
          if (prev.deckId && journalRef.current) saveJournal(prev.deckId, journalRef.current);
          if (prev.deckId) saveLiveTable(prev.deckId, prev);
          setTable(prev);
        }
      } else if (key === "s" || key === "S") {
        dispatch({ type: "shuffle", seatId: seat.id });
      } else if (key === "t" || key === "T") {
        if (!ids.length) return;
        const all = Object.values(seat.zones).flat();
        const cards = ids.map((id) => all.find((c) => c.instanceId === id)).filter((c): c is PlayCard => Boolean(c));
        dispatch({ type: "tapMany", instanceIds: ids, tapped: cards.some((c) => !c.tapped) });
      } else if (key === "f" || key === "F") {
        ids.forEach((id) => dispatch({ type: "flip", instanceId: id }));
      } else if (key === "x" || key === "X") {
        if (ids.length) dispatch({ type: "cloneMany", instanceIds: ids });
      } else if (key === "g" || key === "G") {
        if (ids.length) dispatch({ type: "moveMany", seatId: seat.id, instanceIds: ids, to: "graveyard" });
      } else if (key === "e" || key === "E") {
        if (ids.length) dispatch({ type: "moveMany", seatId: seat.id, instanceIds: ids, to: "exile" });
      } else if (key === "h" || key === "H") {
        if (ids.length) dispatch({ type: "moveMany", seatId: seat.id, instanceIds: ids, to: "hand" });
      } else if (key === "b" || key === "B") {
        if (ids.length) dispatch({ type: "moveMany", seatId: seat.id, instanceIds: ids, to: "battlefield" });
      } else if (key === "c" || key === "C") {
        if (ids.length) dispatch({ type: "moveMany", seatId: seat.id, instanceIds: ids, to: "command" });
      } else if (key === "l" || key === "L") {
        if (!ids.length) return;
        if (e.shiftKey) dispatch({ type: "moveMany", seatId: seat.id, instanceIds: ids, to: "library" });
        else dispatch({ type: "moveMany", seatId: seat.id, instanceIds: ids, to: "library", index: 0 });
      } else if (key === "v" || key === "V") {
        setSearchZone("library");
      } else if (key === "p" || key === "P") {
        dispatch({ type: "proliferate", seatId: seat.id });
      } else if (key === "a" || key === "A") {
        if (ids.length) dispatch({ type: "align", instanceIds: ids });
      } else if (key === "+" || key === "=" || key === "ArrowUp") {
        dispatch({ type: "life", seatId: seat.id, delta: stepFromEvent(e) });
      } else if (key === "-" || key === "_" || key === "ArrowDown") {
        dispatch({ type: "life", seatId: seat.id, delta: -stepFromEvent(e) });
      } else if (key === "Escape") {
        setEnhanceList([]);
        setMarquee(null);
        clearSelection();
      } else if (key === "Alt") setAltPeek(true);
    }
    function onUp(e: KeyboardEvent) {
      if (e.key === "Alt") setAltPeek(false);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onUp);
    };
  }, [clearSelection, dispatch, picked, selected, settings, start, table]);

  const seat = table?.seats[0];
  const seatView = table && seat ? project(table, seat.id) : null;
  const libReveal = (seat && table?.libraryReveal?.[seat.id]) || "hidden";
  const tokens = useMemo(() => (id ? loadDeckTokens(id) : []), [id]);

  function snapField() {
    const rect = fieldRef.current?.getBoundingClientRect() ?? bfRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const { dx, dy, w: cardW, h: cardH } = grabRef.current;
    const cellW = Math.max(12, cardW / 3);
    const cellH = Math.max(10, cardH / 4);
    const rawLeft = ptrRef.current.x - rect.left - dx;
    const rawTop = ptrRef.current.y - rect.top - dy;
    const gx = Math.round(rawLeft / cellW);
    const gy = Math.round(rawTop / cellH);
    const maxLeft = Math.max(0, rect.width - cardW);
    const maxTop = Math.max(0, rect.height - cardH);
    const left = Math.min(maxLeft, Math.max(0, gx * cellW));
    const top = Math.min(maxTop, Math.max(0, gy * cellH));
    return {
      gx,
      gy,
      left,
      top,
      cardW,
      cardH,
      x: rect.width ? (left / rect.width) * 100 : 0,
      y: rect.height ? (top / rect.height) * 100 : 0,
    };
  }

  function onDragStart(e: DragStartEvent) {
    const card = e.active.data.current?.card as PlayCard | undefined;
    setActiveDrag(card ?? null);
    if (card) setSelected(card.instanceId);
    const ev = e.activatorEvent as PointerEvent | MouseEvent | undefined;
    const target = (ev as Event | undefined)?.target as HTMLElement | undefined;
    const node = target?.closest?.("button") ?? target;
    const rect = node?.getBoundingClientRect?.();
    if (ev && rect) {
      grabRef.current = {
        dx: ev.clientX - rect.left,
        dy: ev.clientY - rect.top,
        w: rect.width,
        h: rect.height,
      };
    }
  }

  function onDragEnd(e: DragEndEvent) {
    const snap = snapField();
    setActiveDrag(null);
    if (ghostRef.current) ghostRef.current.style.display = "none";
    const card = e.active.data.current?.card as PlayCard | undefined;
    const zone = e.over?.data.current?.zone as PlayZone | undefined;
    const row = e.over?.data.current?.row as "field" | "lands" | undefined;
    if (!card || !zone || !seat) return;
    const ids = targets(card.instanceId);
    ids.forEach((instanceId, i) => {
      dispatch({
        type: "move",
        seatId: seat.id,
        instanceId,
        to: zone,
        index: zone === "library" ? i : undefined,
      });
      if (zone === "battlefield") {
        dispatch({
          type: "place",
          instanceId,
          x: row === "lands" ? undefined : snap ? snap.x + i * 2 : undefined,
          y: row === "lands" ? undefined : snap?.y,
          row: row ?? "field",
        });
      }
    });
  }

  function CardView({
    card,
    style,
    zone,
    stack,
  }: {
    card: PlayCard;
    style?: CSSProperties;
    zone?: PlayZone;
    stack?: PlayCard[];
  }) {
    const stackIds = (stack && stack.length ? stack : [card]).map((c) => c.instanceId);
    return (
      <PlayFace
        card={card}
        selected={stackIds.some((id) => selected === id || picked.includes(id))}
        style={style}
        stackCount={stackIds.length}
        status={card.token ? tokenStatus(card, table?.turn ?? 1) : "single"}
        ownerMark={
          card.controllerSeat && card.ownerSeat && card.controllerSeat !== card.ownerSeat
            ? table?.seats.find((s) => s.id === card.ownerSeat)?.name
            : undefined
        }
        onStackDelta={
          card.token
            ? (delta) => dispatch({ type: "stackDelta", instanceId: card.instanceId, delta })
            : undefined
        }
        onCounter={
          zone === "battlefield" || card.token
            ? (key, delta) => dispatch({ type: "counterMany", instanceIds: stackIds, key, delta })
            : undefined
        }
        onHover={(c) => {
          hoverRef.current = c;
          setHoverCard(c);
        }}
        onActivate={(ev) => {
          const group = () => {
            const ids =
              stackIds.some((id) => picked.includes(id)) && picked.length > 1
                ? picked
                : stackIds;
            const map = new Map(
              (table?.seats ?? []).flatMap((s) => Object.values(s.zones).flat()).map((c) => [c.instanceId, c])
            );
            return ids.map((id) => map.get(id)).filter((c): c is PlayCard => Boolean(c));
          };
          if (ev.altKey || altPeek) {
            openEnhance(group());
            return;
          }
          if (ev.ctrlKey || ev.metaKey) {
            setPicked((cur) => {
              const has = stackIds.every((id) => cur.includes(id));
              return has ? cur.filter((id) => !stackIds.includes(id)) : [...cur, ...stackIds];
            });
            setSelected(card.instanceId);
            return;
          }
          const now = Date.now();
          if (
            lastClickRef.current.id === card.instanceId &&
            now - lastClickRef.current.at < 400
          ) {
            lastClickRef.current = { id: "", at: 0 };
            if (card.token && stackIds.length > 1) {
              dispatch({ type: "tap", instanceId: stackIds[stackIds.length - 1], tapped: true });
              return;
            }
            if (card.token && card.tapped) {
              dispatch({ type: "tap", instanceId: card.instanceId, tapped: false });
              return;
            }
            const cards = group();
            dispatch({
              type: "tapMany",
              instanceIds: cards.map((c) => c.instanceId),
              tapped: cards.some((c) => !c.tapped),
            });
            return;
          }
          lastClickRef.current = { id: card.instanceId, at: now };
          setPicked(stackIds);
          setSelected(card.instanceId);
        }}
        onGrab={(ev) => {
          const r = (ev.currentTarget as HTMLElement).getBoundingClientRect();
          grabRef.current = {
            dx: ev.clientX - r.left,
            dy: ev.clientY - r.top,
            w: r.width,
            h: r.height,
          };
        }}
        onMenu={(ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          if (zone === "library") {
            setLibMenu(clampMenu(ev.clientX, ev.clientY, 220, 420));
            return;
          }
          setSelected(card.instanceId);
          if (!stackIds.every((id) => picked.includes(id))) setPicked(stackIds);
          setMenu({ ...clampMenu(ev.clientX, ev.clientY, 200, 320), card });
        }}
      />
    );
  }

  function Pile({ zone, label }: { zone: PlayZone; label: string }) {
    if (!seat) return null;
    const cards = seat.zones[zone];
    const top = zone === "library" ? cards[0] : cards[cards.length - 1] ?? cards[0];
    const stacked = zone === "library" || zone === "graveyard" || zone === "exile" || zone === "command";
    return (
      <ZoneDrop zone={zone} className={`${styles.pile} ${styles.pileCompact}`}>
        <button
          type="button"
          className={styles.pileHead}
          onClick={(e) => {
            e.stopPropagation();
            if (zone === "graveyard" || zone === "exile" || zone === "command" || zone === "sideboard") {
              setSearchZone(zone);
            }
          }}
        >
          <span>{label}</span>
          <span>{cards.length}</span>
        </button>
        <div
          className={styles.pileBody}
          onClick={(e) => {
            if (zone !== "library") return;
            e.stopPropagation();
            dispatch({ type: "draw", seatId: seat.id, n: settings.drawCount });
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (zone === "library") setLibMenu(clampMenu(e.clientX, e.clientY, 210, 360));
            else setSearchZone(zone);
          }}
        >
          {stacked && top ? (
            <CardView
              zone={zone}
              card={
                zone === "library" && libReveal === "hidden"
                  ? { ...top, facedown: true }
                  : top
              }
            />
          ) : stacked ? (
            <span className={styles.hint}>Empty</span>
          ) : (
            cards.slice(-3).map((c) => <CardView key={c.instanceId} card={c} zone={zone} />)
          )}
        </div>
      </ZoneDrop>
    );
  }

  if (loading) {
    return (
      <div className={`${transitions.page} ${styles.page}`}>
        <p className={styles.muted}>Shuffling up…</p>
      </div>
    );
  }
  if (error || !table || !seat) {
    return (
      <div className={`${transitions.page} ${styles.page}`}>
        <p className={styles.muted}>{error ?? "Could not start playtest."}</p>
        <Link to={id ? `/deck/${id}` : "/my-decks"} className={styles.back}>
          Back to deck
        </Link>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={onDragStart}
      onDragMove={(e) => {
        const el = ghostRef.current;
        if (!el) return;
        const over = e.over?.data.current as { zone?: PlayZone; row?: string } | undefined;
        if (over?.zone !== "battlefield" || over?.row !== "field") {
          el.style.display = "none";
          return;
        }
        const snap = snapField();
        if (!snap) {
          el.style.display = "none";
          return;
        }
        el.style.display = "block";
        el.style.left = `${snap.left}px`;
        el.style.top = `${snap.top}px`;
        el.style.width = `${snap.cardW}px`;
        el.style.height = `${snap.cardH}px`;
      }}
      onDragEnd={onDragEnd}
      onDragCancel={() => {
        setActiveDrag(null);
        if (ghostRef.current) ghostRef.current.style.display = "none";
      }}
    >
      <div
        className={`${transitions.page} ${styles.page}`}
        style={{
          ["--board-card" as string]: `${4.8 * (settings.boardScale || 1)}rem`,
          ["--hand-card" as string]: `${4.8 * (settings.handScale || 1)}rem`,
        }}
        onPointerDown={(e) => {
          const t = e.target as HTMLElement;
          if (t.closest("[data-play-id]") || t.closest(`.${styles.menu}`) || t.closest("input")) return;
          if (e.button === 0) {
            clearSelection();
          }
        }}
        onContextMenu={(e) => {
          const t = e.target as HTMLElement;
          if (t.closest("button") || t.closest("a") || t.closest("input") || t.closest(`.${styles.card}`)) return;
          e.preventDefault();
          setMenu(null);
          setBranch(null);
          setTableMenu(clampMenu(e.clientX, e.clientY, 220, 360));
        }}
      >
        <div className={styles.top}>
          <div className={styles.identity}>
          <Link to={`/deck/${id}`} className={styles.back}>
            ← {table.deckName}
          </Link>
          <h1 className={styles.title}>Table</h1>
          <span className={styles.muted}>
            Turn {table.turn} · {table.phase ?? "main"} · {table.format}
          </span>
          </div>
          <div className={styles.tools}>
          <button type="button" className={styles.btn} onClick={() => setSettingsOpen(true)}>
            Settings
          </button>
          <button type="button" className={styles.btn} onClick={() => setKit({ kind: "tokens", tab: "tokens" })}>
            Tokens
          </button>
          <button type="button" className={styles.btn} onClick={() => setKit({ kind: "side", tab: "side" })}>
            Side
          </button>
          <button type="button" className={styles.btn} onClick={() => setKit({ kind: "spawn", tab: "spawn" })}>
            Spawn
          </button>
          <button type="button" className={styles.btn} onClick={() => setLogOpen((v) => !v)}>
            {logOpen ? "Hide log" : "Log"}
          </button>
          <button type="button" className={styles.primary} onClick={() => void start(true)}>
            New game
          </button>
          <div className={styles.stats}>
            {(
              [
                ["Life", "life", "life"],
                ["Poison", "poison", "stat"],
                ["Energy", "energy", "stat"],
                ["XP", "experience", "stat"],
              ] as const
            ).map(([label, key, kind]) => (
              <button
                key={key}
                type="button"
                className={styles.stat}
                onClick={(e) => {
                  const d = stepFromEvent(e);
                  if (kind === "life") dispatch({ type: "life", seatId: seat.id, delta: d });
                  else dispatch({ type: "stat", seatId: seat.id, key, delta: d });
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  const d = -stepFromEvent(e);
                  if (kind === "life") dispatch({ type: "life", seatId: seat.id, delta: d });
                  else dispatch({ type: "stat", seatId: seat.id, key, delta: d });
                }}
              >
                {label} {kind === "life" ? seat.life : seat[key]}
              </button>
            ))}
            <button type="button" className={styles.btn} onClick={() => {
              if (!table) return;
              channelRef.current?.close();
              const code = table.id;
              setRoomCode(code);
              setRole("host");
              setViewerSeat(table.seats[0].id);
              void publishTable(code, table, table.seats[0].id);
              channelRef.current = openHostedTable(code, "host", table.seats[0].name, (msg) => {
                if (msg.kind === "join") {
                  dispatch({ type: "ensureSeat", name: msg.name || "Guest" });
                } else if (msg.kind === "intent") {
                  setTable((cur) => {
                    if (!cur) return cur;
                    const reason = acceptIntent(cur, msg.action, msg.from);
                    if (reason) {
                      channelRef.current?.send({ kind: "reject", text: reason, from: cur.seats[0].id });
                      return cur;
                    }
                    return cur;
                  });
                  dispatch(msg.action);
                }
              });
            }}>Share</button>
            <input className={styles.costInput} value={roomCode} placeholder="Room" onChange={(e) => setRoomCode(e.target.value)} />
            <button type="button" className={styles.btn} onClick={() => {
              if (!roomCode) return;
              channelRef.current?.close();
              setRole("guest");
              channelRef.current = openHostedTable(roomCode, "guest", user?.email || "Guest", (msg) => {
                if (msg.kind === "welcome" || msg.kind === "snapshot") {
                  setViewerSeat(msg.kind === "welcome" ? msg.seatId : viewerSeat);
                  journalRef.current = emptyJournal(msg.state);
                  dispatch({ type: "hydrate", state: msg.state });
                } else if (msg.kind === "action") {
                  remoteRef.current = true;
                  dispatch(msg.action);
                  remoteRef.current = false;
                } else if (msg.kind === "reject") {
                  setError(msg.text);
                }
              });
              channelRef.current.send({ kind: "join", from: "guest", name: user?.email || "Guest" });
            }}>Join</button>
          </div>
          </div>
        </div>
        <div className={styles.cmdStrip}>
          <button
            type="button"
            className={styles.stat}
            onClick={(e) => dispatch({ type: "tax", seatId: seat.id, delta: stepFromEvent(e) })}
            onContextMenu={(e) => {
              e.preventDefault();
              dispatch({ type: "tax", seatId: seat.id, delta: -stepFromEvent(e) });
            }}
          >
            Tax {seat.commanderTax ?? 0}
          </button>
          <button
            type="button"
            className={styles.stat}
            onClick={(e) => dispatch({ type: "cmdDamage", seatId: seat.id, from: "opp", delta: stepFromEvent(e) })}
            onContextMenu={(e) => {
              e.preventDefault();
              dispatch({ type: "cmdDamage", seatId: seat.id, from: "opp", delta: -stepFromEvent(e) });
            }}
          >
            Cmd dmg {seat.commanderDamage?.opp ?? 0}
          </button>
          <button type="button" className={styles.stat} onClick={() => dispatch({ type: "untapAll", seatId: seat.id })}>
            Untap
          </button>
          <button type="button" className={styles.stat} onClick={() => dispatch({ type: "proliferate", seatId: seat.id })}>
            Proliferate
          </button>
          <button type="button" className={styles.stat} onClick={() => setFogSeats((v) => !v)}>
            {fogSeats ? "Full table" : "Seat view"}
          </button>
        </div>
        {seatView ? (
          <div className={styles.cmdStrip}>
            <span className={styles.railCount}>actions {journalRef.current?.seq ?? 0}</span>
            {seatView.others.map((o) => (
              <span key={o.id} className={styles.stat}>
                {o.name} · life {o.life} · hand {fogSeats ? o.hand : o.hand} · lib {o.library}
                {o.revealedTop ? ` · top ${o.revealedTop.name}` : fogSeats ? " · library hidden" : ""}
              </span>
            ))}
          </div>
        ) : null}
        {seat && table ? (
          <div className={styles.cmdStrip}>
            {settings.assistants?.autoTap ? (
              <>
                <input className={styles.costInput} value={tapCost} placeholder="Cost 2G" onChange={(e) => setTapCost(e.target.value)} />
                <button type="button" className={styles.stat} onClick={() => {
                  const ids = suggestLandTaps(seat.zones.battlefield, tapCost);
                  if (!ids?.length) return;
                  dispatch({ type: "tapMany", instanceIds: ids, tapped: true });
                  setTapCost("");
                }}>Tap lands</button>
              </>
            ) : null}
            {pendingTax ? (
              <button type="button" className={styles.primary} onClick={() => {
                dispatch({ type: "tax", seatId: seat.id, delta: 1 });
                dispatch({ type: "cast", instanceId: pendingTax.instanceId });
                setPendingTax(null);
              }}>Cast {pendingTax.name} · tax {seat.commanderTax ?? 0}</button>
            ) : null}
            {settings.assistants?.death ? deadCreatures(table).map((c) => (
              <button key={c.instanceId} type="button" className={styles.stat} onClick={() => dispatch({ type: "move", seatId: c.ownerSeat, instanceId: c.instanceId, to: "graveyard", toOwner: true })}>
                {c.name} dead · grave
              </button>
            )) : null}
            {settings.assistants?.legend ? legendClashes(table).map((clash) => (
              <span key={clash.name} className={styles.stat}>Legend · {clash.cards[0].name} ×{clash.cards.length}</span>
            )) : null}
          </div>
        ) : null}

        <div className={styles.phases}>
          {(["untap", "upkeep", "draw", "main", "combat", "main2", "end"] as const).map((phase) => (
            <button
              key={phase}
              type="button"
              className={table.phase === phase ? styles.primary : styles.stat}
              onClick={() => sendIntent({ type: "setPhase", phase })}
            >
              {phase}
            </button>
          ))}
        </div>

        <div className={styles.board}>
          <div className={`${styles.battlefield} ${styles[`mat${(settings.playmat || "felt")[0].toUpperCase()}${(settings.playmat || "felt").slice(1)}`] ?? styles.matFelt}`} ref={bfRef}>
            <div className={styles.pileHead}>
              <span>Battlefield</span>
              <span>
                {table.seats.reduce((n, s) => n + s.zones.battlefield.filter((c) => c.row !== "lands").length, 0)}
              </span>
            </div>
            <ZoneDrop
              zone="battlefield"
              row="field"
              className={styles.bfField}
              innerRef={fieldRef}
              onPointerDown={(e) => {
                if (e.button !== 0) return;
                if ((e.target as HTMLElement).closest("[data-play-id]")) return;
                setMarquee({ x0: e.clientX, y0: e.clientY, x1: e.clientX, y1: e.clientY });
              }}
            >
              <span ref={ghostRef} className={styles.gridGhost} style={{ display: "none" }} />
              {groupFieldCards(
                table.seats.flatMap((s) => s.zones.battlefield.filter((c) => c.row !== "lands")),
                table.turn
              ).map(({ card: c, stack }) => (
                  <CardView
                    key={c.instanceId}
                    card={c}
                    zone="battlefield"
                    stack={stack}
                    style={
                      c.x != null && c.y != null
                        ? {
                            position: "absolute",
                            left: `${c.x}%`,
                            top: `${c.y}%`,
                          }
                        : undefined
                    }
                  />
                ))}
            </ZoneDrop>
            <ZoneDrop zone="battlefield" row="lands" className={styles.landRail}>
              <div className={styles.railHead}>
                <span className={styles.railCount}>
                  {table.seats.reduce((n, s) => n + s.zones.battlefield.filter((c) => c.row === "lands").length, 0)}
                </span>
                <span className={styles.railLabel}>Lands</span>
              </div>
              <div className={styles.railScroll} ref={landScroll}>
                {Object.values(
                  table.seats.flatMap((s) => s.zones.battlefield)
                    .filter((c) => c.row === "lands")
                    .reduce<Record<string, PlayCard[]>>((acc, c) => {
                      const k = c.oracleId || c.name;
                      (acc[k] ??= []).push(c);
                      return acc;
                    }, {})
                ).map((stack) => (
                  <div key={stack[0].instanceId} className={styles.landStack}>
                    {stack.map((c, i) => (
                      <CardView
                        key={c.instanceId}
                        card={c}
                        style={{ marginLeft: i ? -36 : 0, zIndex: i }}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </ZoneDrop>
          </div>
          <div className={styles.col}>
            <div className={`${styles.pile} ${styles.pileCompact}`}>
              <div className={styles.pileHead}>
                <span>Stack</span>
                <span>{table.stackItems?.length ?? 0}</span>
              </div>
              <div className={styles.stackCol}>
                {[...(table.stackItems ?? [])].reverse().map((item, i) => (
                  <div key={item.id} className={i === 0 ? styles.stackTop : styles.stackItem}>
                    <strong>{item.name}</strong>
                    <span>{item.kind}{item.x != null ? ` · X=${item.x}` : ""}{item.targets.length ? ` · ${item.targets.join(", ")}` : ""}</span>
                  </div>
                ))}
              </div>
              <div className={styles.mulliganRow}>
                <button type="button" className={styles.ghost} onClick={() => dispatch({ type: "pass", seatId: seat.id })}>Pass</button>
                <button type="button" className={styles.ghost} onClick={() => dispatch({ type: "resolveTop", to: "battlefield" })}>Resolve</button>
                <button type="button" className={styles.ghost} onClick={() => dispatch({ type: "resolveTop", to: "graveyard" })}>To grave</button>
                <button type="button" className={styles.ghost} onClick={() => dispatch({ type: "counterSpell" })}>Counter</button>
                <button type="button" className={styles.ghost} onClick={() => dispatch({ type: "copySpell" })}>Copy</button>
              </div>
            </div>
            <Pile zone="command" label="Command" />
            <Pile zone="exile" label="Exile" />
            <Pile zone="graveyard" label="GY" />
            <Pile zone="library" label="Library" />
          </div>
        </div>

        <ZoneDrop zone="hand" className={`${styles.hand} ${settings.hideHand ? styles.handHidden : ""}`}>
          <div className={styles.pileHead}>
            <span>Hand</span>
            <span>{seat.zones.hand.length}</span>
            <button type="button" className={styles.ghost} onClick={() => dispatch({ type: "sortHand", seatId: seat.id, by: "cmc" })}>CMC</button>
            <button type="button" className={styles.ghost} onClick={() => dispatch({ type: "sortHand", seatId: seat.id, by: "type" })}>Type</button>
            <button type="button" className={styles.ghost} onClick={() => persist({ ...settings, hideHand: !settings.hideHand })}>
              {settings.hideHand ? "Show" : "Hide"}
            </button>
          </div>
          <div className={styles.handRow} ref={handScroll}>
            {settings.hideHand ? (
              <span className={styles.hiddenHand}>Hand hidden · {seat.zones.hand.length}</span>
            ) : (
              seat.zones.hand.map((c) => (
                <CardView key={c.instanceId} card={c} zone="hand" />
              ))
            )}
          </div>
        </ZoneDrop>

        {logOpen && (
          <aside className={styles.logPop}>
            <div className={styles.pileHead}>
              <span>Event log</span>
              <button type="button" className={styles.ghost} onClick={() => setLogOpen(false)}>
                Close
              </button>
            </div>
            {[...table.log].reverse().map((l, i) => (
              <div key={`${l.at}-${i}`}>{l.text}</div>
            ))}
          </aside>
        )}

        {menu && (
          <MenuBox x={menu.x} y={menu.y}>
            <div className={styles.xRail}>
              <button
                type="button"
                className={styles.xChip}
                onClick={(e) => { e.stopPropagation(); setLibSlot((n) => bumpX(n, e, 1)); }}
                onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setLibSlot((n) => bumpX(n, e, -1)); }}
              >
                X={libSlot}
              </button>
            </div>
            <button type="button" onClick={() => {
              const ids = targets(menu.card.instanceId);
              const all = Object.values(seat.zones).flat();
              setEnhanceList(ids.map((id) => all.find((x) => x.instanceId === id)).filter((x): x is PlayCard => Boolean(x)));
              setMenu(null);
            }}>Enhance</button>
            <button type="button" onClick={() => {
              const ids = targets(menu.card.instanceId);
              const all = Object.values(seat.zones).flat();
              const cards = ids.map((id) => all.find((c) => c.instanceId === id)).filter((c): c is PlayCard => Boolean(c));
              dispatch({ type: "tapMany", instanceIds: ids, tapped: cards.some((c) => !c.tapped) });
              setMenu(null);
            }}>Tap / untap</button>
            {menu.card.token && !menu.card.tapped && seat.zones.battlefield.filter((c) => c.token && !c.tapped && tokenStackKey(c, table.turn) === tokenStackKey(menu.card, table.turn)).length > 1 ? (
              <button type="button" onClick={() => {
                const ids = seat.zones.battlefield
                  .filter((c) => c.token && !c.tapped && tokenStackKey(c, table.turn) === tokenStackKey(menu.card, table.turn))
                  .map((c) => c.instanceId);
                dispatch({ type: "tapMany", instanceIds: ids, tapped: true });
                setMenu(null);
              }}>Tap all</button>
            ) : null}
            <button type="button" onClick={() => {
              dispatch({ type: "counterMany", instanceIds: targets(menu.card.instanceId), key: plusKey(menu.card), delta: 1 });
            }}>+ {plusKey(menu.card)}</button>
            <button type="button" onClick={() => {
              dispatch({ type: "align", instanceIds: targets(menu.card.instanceId) });
              setMenu(null);
            }}>Align</button>
            {picked.length > 1 ? (
              <button type="button" onClick={() => {
                dispatch({ type: "attach", instanceIds: targets(menu.card.instanceId).filter((id) => id !== menu.card.instanceId), to: menu.card.instanceId });
                setMenu(null);
              }}>Attach selection</button>
            ) : null}
            {menu.card.attachedTo ? (
              <button type="button" onClick={() => {
                dispatch({ type: "attach", instanceIds: [menu.card.instanceId], to: null });
                setMenu(null);
              }}>Detach</button>
            ) : null}
            <button type="button" onClick={() => setBranch((b) => (b === "move" ? null : "move"))}>Move to ▸</button>
            {branch === "move" && (
              <div className={styles.menuBlock}>
                {MOVE_ZONES.map((z) =>
                  z.id === "library" ? (
                    <div key={z.id}>
                      <button type="button" onClick={() => setLibDestOpen((v) => !v)}>Library ▸</button>
                      {libDestOpen && (
                        <div className={styles.menuBlock}>
                          <button type="button" onClick={() => {
                            targets(menu.card.instanceId).forEach((id, i) =>
                              dispatch({ type: "move", seatId: seat.id, instanceId: id, to: "library", index: i })
                            );
                            setMenu(null); setBranch(null); setLibDestOpen(false);
                          }}>Top</button>
                          <button type="button" onClick={() => {
                            targets(menu.card.instanceId).forEach((id) =>
                              dispatch({ type: "move", seatId: seat.id, instanceId: id, to: "library" })
                            );
                            setMenu(null); setBranch(null); setLibDestOpen(false);
                          }}>Bottom</button>
                          <button type="button" onClick={() => {
                            const slot = Math.max(1, libSlot) - 1;
                            targets(menu.card.instanceId).forEach((id, i) =>
                              dispatch({ type: "move", seatId: seat.id, instanceId: id, to: "library", index: slot + i })
                            );
                            setMenu(null); setBranch(null); setLibDestOpen(false);
                          }}>Slot {xv(libSlot)} from top</button>
                          <button type="button" onClick={() => {
                            targets(menu.card.instanceId).forEach((id) =>
                              dispatch({ type: "move", seatId: seat.id, instanceId: id, to: "library" })
                            );
                            dispatch({ type: "shuffle", seatId: seat.id });
                            setMenu(null); setBranch(null); setLibDestOpen(false);
                          }}>Shuffle in</button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <button
                      key={z.id}
                      type="button"
                      onClick={() => {
                        targets(menu.card.instanceId).forEach((id) =>
                          dispatch({ type: "move", seatId: seat.id, instanceId: id, to: z.id })
                        );
                        setMenu(null); setBranch(null);
                      }}
                    >
                      {z.label}
                    </button>
                  )
                )}
              </div>
            )}
            {searchZone === "library" && (
              <>
                <button type="button" onClick={() => setBranch((b) => (b === "libcard" ? null : "libcard"))}>Library actions ▸</button>
                {branch === "libcard" && (
                  <div className={styles.menuBlock}>
                    <button type="button" onClick={() => {
                      dispatch({ type: "move", seatId: seat.id, instanceId: menu.card.instanceId, to: "library", index: 0 });
                      dispatch({ type: "shuffle", seatId: seat.id });
                      dispatch({ type: "move", seatId: seat.id, instanceId: menu.card.instanceId, to: "library", index: 0 });
                      setMenu(null);
                    }}>Shuffle, place on top</button>
                    <button type="button" onClick={() => {
                      dispatch({ type: "log", text: `Revealed ${menu.card.name}` });
                      dispatch({ type: "move", seatId: seat.id, instanceId: menu.card.instanceId, to: "hand" });
                      dispatch({ type: "shuffle", seatId: seat.id });
                      setMenu(null);
                    }}>Reveal, hand, shuffle</button>
                    <button type="button" onClick={() => {
                      dispatch({ type: "log", text: `Revealed ${menu.card.name}` });
                      dispatch({ type: "shuffle", seatId: seat.id });
                      dispatch({ type: "move", seatId: seat.id, instanceId: menu.card.instanceId, to: "library", index: 0 });
                      setMenu(null);
                    }}>Reveal, shuffle, put on top</button>
                    <button type="button" onClick={() => {
                      dispatch({ type: "move", seatId: seat.id, instanceId: menu.card.instanceId, to: "hand" });
                      dispatch({ type: "shuffle", seatId: seat.id });
                      setMenu(null);
                    }}>Hand & shuffle</button>
                    <button type="button" onClick={() => {
                      dispatch({ type: "move", seatId: seat.id, instanceId: menu.card.instanceId, to: "library", index: 0 });
                      setMenu(null);
                    }}>Place on top</button>
                  </div>
                )}
              </>
            )}
            <button type="button" onClick={() => setBranch((b) => (b === "cardx" ? null : "cardx"))}>More ▸</button>
            {branch === "cardx" && (
              <div className={styles.menuBlock}>
                <button type="button" onClick={() => { dispatch({ type: "facedown", instanceId: menu.card.instanceId }); setMenu(null); }}>Flip card</button>
                <button type="button" onClick={() => { dispatch({ type: "flip", instanceId: menu.card.instanceId }); setMenu(null); }}>Switch face</button>
                <button type="button" onClick={() => {
                  dispatch({
                    type: "gainControl",
                    instanceId: menu.card.instanceId,
                    seatId: "opponent",
                    untilEndOfTurn: true,
                  });
                  setMenu(null);
                }}>Gain control until end of turn</button>
                <button type="button" onClick={() => {
                  dispatch({ type: "gainControl", instanceId: menu.card.instanceId, seatId: "opponent" });
                  setMenu(null);
                }}>Gain control</button>
                <button type="button" onClick={() => {
                  const fromCommand = table.seats.some((s) => s.zones.command.some((c) => c.instanceId === menu.card.instanceId));
                  if (settings.assistants?.tax && fromCommand) setPendingTax(menu.card);
                  else dispatch({ type: "cast", instanceId: menu.card.instanceId });
                  setMenu(null);
                }}>Cast</button>
                <button type="button" onClick={() => {
                  dispatch({ type: "activate", instanceId: menu.card.instanceId, name: `${menu.card.name} ability` });
                  setMenu(null);
                }}>Activate</button>
                <button type="button" onClick={() => {
                  dispatch({ type: "counter", instanceId: menu.card.instanceId, key: "toughness", delta: libSlot - (menu.card.counters.toughness ?? menu.card.toughness ?? 0) });
                  setMenu(null);
                }}>Set toughness to X</button>
                {menu.card.controllerSeat !== menu.card.ownerSeat ? (
                  <button type="button" onClick={() => {
                    dispatch({ type: "releaseControl", instanceId: menu.card.instanceId });
                    setMenu(null);
                  }}>Give back</button>
                ) : null}
                <button type="button" onClick={() => {
                  dispatch({ type: "cloneMany", instanceIds: targets(menu.card.instanceId) });
                  setMenu(null);
                }}>Make Token Copy</button>
                <button type="button" onClick={() => { setInspect(menu.card); setMenu(null); }}>Card page</button>
                <button type="button" onClick={() => {
                  dispatch({ type: "removeMany", instanceIds: targets(menu.card.instanceId) });
                  clearSelection();
                  setMenu(null);
                }}>Remove from table</button>
              </div>
            )}
          </MenuBox>
        )}
        {tableMenu && (
          <MenuBox x={tableMenu.x} y={tableMenu.y}>
            <div className={styles.xRail}>
              <button
                type="button"
                className={styles.xChip}
                onClick={(e) => { e.stopPropagation(); setLibX((n) => bumpX(n, e, 1)); }}
                onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setLibX((n) => bumpX(n, e, -1)); }}
              >
                X={libX}
              </button>
            </div>
            <button type="button" onClick={() => { dispatch({ type: "draw", seatId: seat.id, n: libX }); setTableMenu(null); }}>Draw {xv(libX)}</button>
            <button type="button" onClick={() => { dispatch({ type: "nextTurn", untap: settings.nextTurnUntap, draw: settings.nextTurnDraw }); setTableMenu(null); }}>Next turn</button>
            <button type="button" onClick={() => { dispatch({ type: "shuffle", seatId: seat.id }); setTableMenu(null); }}>Shuffle</button>
            <button type="button" onClick={() => { dispatch({ type: "untapAll", seatId: seat.id }); setTableMenu(null); }}>Untap all</button>
            <button type="button" onClick={() => { dispatch({ type: "proliferate", seatId: seat.id }); setTableMenu(null); }}>Proliferate</button>
            <button type="button" onClick={() => { dispatch({ type: "mulligan", seatId: seat.id, kind: settings.mulligan }); setTableMenu(null); }}>Mulligan</button>
            <button type="button" onClick={() => setBranch((b) => (b === "mech" ? null : "mech"))}>Mechanics ▸</button>
            {branch === "mech" && (
              <div className={styles.menuBlock}>
                <button type="button" onClick={() => { dispatch({ type: "mill", seatId: seat.id, n: libX }); setTableMenu(null); }}>Mill {xv(libX)}</button>
                <button type="button" onClick={() => { setLookKind("scry"); setScryN(seat.zones.library.slice(0, libX)); setTableMenu(null); }}>Scry/Surveil {xv(libX)}</button>
                <button type="button" onClick={() => { setLookKind("searchTop"); setScryN(seat.zones.library.slice(0, libX)); setTableMenu(null); }}>Search top {xv(libX)}</button>
              </div>
            )}
            <button type="button" onClick={() => setBranch((b) => (b === "roll" ? null : "roll"))}>Roll / flip ▸</button>
            {branch === "roll" && (
              <div className={styles.menuBlock}>
                <button type="button" onClick={() => { dispatch({ type: "log", text: `d20 = ${roll(20)}` }); setTableMenu(null); }}>d20</button>
                <button type="button" onClick={() => { dispatch({ type: "log", text: `d6 = ${roll(6)}` }); setTableMenu(null); }}>d6</button>
                <button type="button" onClick={() => { dispatch({ type: "log", text: `d${libX} = ${roll(libX)}` }); setTableMenu(null); }}>d{xv(libX)}</button>
                <button type="button" onClick={() => { const face = Math.random() < 0.5 ? "Heads" : "Tails"; setCoin(face); dispatch({ type: "log", text: `Coin: ${face}` }); setTableMenu(null); }}>Coin flip</button>
                <button type="button" onClick={() => {
                  const flips = Array.from({ length: libX }, () => (Math.random() < 0.5 ? "H" : "T"));
                  dispatch({ type: "log", text: `Flip ${libX}: ${flips.join(" ")}` });
                  setTableMenu(null);
                }}>Flip {xv(libX)}</button>
              </div>
            )}
            <button type="button" onClick={() => setBranch((b) => (b === "extra" ? null : "extra"))}>Extra ▸</button>
            {branch === "extra" && (
              <div className={styles.menuBlock}>
                <button type="button" onClick={() => { const prev = history.current.pop(); if (prev) dispatch({ type: "hydrate", state: prev }); setTableMenu(null); }}>Undo</button>
                <button type="button" onClick={() => { setKit({ kind: "tokens", tab: "tokens" }); setTableMenu(null); }}>Tokens</button>
                <button type="button" onClick={() => { setKit({ kind: "side", tab: "side" }); setTableMenu(null); }}>Sideboard</button>
                <button type="button" onClick={() => { setSettingsOpen(true); setTableMenu(null); }}>Settings</button>
              </div>
            )}
          </MenuBox>
        )}

        {libMenu && (
          <MenuBox x={libMenu.x} y={libMenu.y}>
            <div className={styles.xRail}>
              <button
                type="button"
                className={styles.xChip}
                onClick={(e) => { e.stopPropagation(); setLibX((n) => bumpX(n, e, 1)); }}
                onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setLibX((n) => bumpX(n, e, -1)); }}
              >
                X={libX}
              </button>
            </div>
            <button type="button" onClick={() => { dispatch({ type: "draw", seatId: seat.id, n: libX }); setLibMenu(null); }}>Draw {xv(libX)}</button>
            <button type="button" onClick={() => { setSearchZone("library"); setLibMenu(null); }}>Search</button>
            <button type="button" onClick={() => { dispatch({ type: "shuffle", seatId: seat.id }); setLibMenu(null); }}>Shuffle</button>
            <button type="button" onClick={() => setBranch((b) => (b === "mech" ? null : "mech"))}>Mechanics ▸</button>
            {branch === "mech" && (
              <div className={styles.menuBlock}>
                <button type="button" onClick={() => { setLookKind("searchTop"); setScryN(seat.zones.library.slice(0, libX)); setLibMenu(null); }}>Search top {xv(libX)}</button>
                <button type="button" onClick={() => { setLookKind("scry"); setScryN(seat.zones.library.slice(0, libX)); setLibMenu(null); }}>Scry/Surveil {xv(libX)}</button>
                <button type="button" onClick={() => { dispatch({ type: "mill", seatId: seat.id, n: libX }); setLibMenu(null); }}>Mill {xv(libX)}</button>
                <button type="button" onClick={() => { dispatch({ type: "exileTop", seatId: seat.id, n: libX }); setLibMenu(null); }}>Exile {xv(libX)}</button>
                <button type="button" onClick={() => {
                  const revealed: PlayCard[] = [];
                  let hit: string | null = null;
                  for (const c of seat.zones.library) {
                    revealed.push(c);
                    const land = /\bland\b/i.test(c.typeLine);
                    if (!land && manaValue(c) < libX) { hit = c.instanceId; break; }
                  }
                  setLookKind("cascade"); setCascadeHit(hit); setScryN(revealed); setLibMenu(null);
                }}>Cascade {xv(libX)}</button>
                <button type="button" onClick={() => {
                  const revealed: PlayCard[] = [];
                  let hit: string | null = null;
                  for (const c of seat.zones.library) {
                    revealed.push(c);
                    const land = /\bland\b/i.test(c.typeLine);
                    if (!land && manaValue(c) <= libX) { hit = c.instanceId; break; }
                  }
                  setLookKind("discover"); setCascadeHit(hit); setScryN(revealed); setLibMenu(null);
                }}>Discover {xv(libX)}</button>
              </div>
            )}
            <button type="button" onClick={() => setBranch((b) => (b === "reveal" ? null : "reveal"))}>Reveal ▸</button>
            {branch === "reveal" && (
              <div className={styles.menuBlock}>
                <button type="button" onClick={() => { dispatch({ type: "revealTop", seatId: seat.id, mode: "self" }); setLibMenu(null); }}>Reveal top (only me)</button>
                <button type="button" onClick={() => { dispatch({ type: "revealTop", seatId: seat.id, mode: "all" }); setLibMenu(null); }}>Reveal top (all)</button>
                <button type="button" onClick={() => { dispatch({ type: "revealTop", seatId: seat.id, mode: "hidden" }); setLibMenu(null); }}>Hide top</button>
              </div>
            )}
            <button type="button" onClick={() => setBranch((b) => (b === "lands" ? null : "lands"))}>Basic lands ▸</button>
            {branch === "lands" && (
              <div className={styles.menuBlock}>
                {["Plains", "Island", "Swamp", "Mountain", "Forest", "Wastes"]
                  .map((name) => Object.values(seat.zones).flat().find((c) => c.name === name))
                  .filter((c): c is PlayCard => Boolean(c))
                  .map((land) => (
                    <button
                      key={land.oracleId}
                      type="button"
                      onClick={() => {
                        dispatch({ type: "move", seatId: seat.id, instanceId: land.instanceId, to: "battlefield" });
                        dispatch({ type: "place", instanceId: land.instanceId, row: "lands" });
                        setLibMenu(null);
                      }}
                    >
                      Get {land.name}
                    </button>
                  ))}
              </div>
            )}
          </MenuBox>
        )}

        {searchZone && (
          <div className={styles.overlay} onClick={() => setSearchZone(null)}>
            <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
              <h2>
                Search {searchZone} ({seat.zones[searchZone].length})
              </h2>
              <input
                className={styles.btn}
                style={{ width: "100%", borderRadius: 8, marginBottom: 8 }}
                placeholder="Filter…"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
              <div className={styles.lookGrid}>
                {seat.zones[searchZone]
                  .filter((c) => c.name.toLowerCase().includes(filter.toLowerCase()))
                  .map((c) => (
                    <div key={c.instanceId} className={styles.lookCard}>
                      <CardView card={c} />
                      <span className={styles.lookName}>{c.name}</span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

        {scryN && (
          <div className={styles.overlay} onClick={() => setScryN(null)}>
            <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
              <h2>
                {lookKind === "cascade"
                  ? `Cascade ${libX}`
                  : lookKind === "discover"
                    ? `Discover ${libX}`
                    : lookKind === "searchTop"
                      ? `Top ${scryN.length}`
                      : `Scry/Surveil ${scryN.length}`}
              </h2>
              {lookKind === "cascade" && (
                <p className={styles.hint}>
                  {cascadeHit ? "Nonland found. Cast it or leave it; the rest go to the bottom." : "No nonland cheaper than X. Revealed cards go to the bottom."}
                </p>
              )}
              {lookKind === "discover" && (
                <p className={styles.hint}>
                  {cascadeHit
                    ? "Nonland with MV ≤ X found. Cast it or put the pile on the bottom in random order."
                    : "No nonland with MV ≤ X. Revealed cards go to the bottom in random order."}
                </p>
              )}
              {lookKind === "scry" && (
                <p className={styles.hint}>
                  Arrange cards left on top. Send others to the bottom (scry) or graveyard (surveil), then Done.
                </p>
              )}
              <div className={styles.lookGrid}>
                {scryN.map((c) => (
                  <div key={c.instanceId} className={`${styles.lookCard}${cascadeHit === c.instanceId ? ` ${styles.lookHit}` : ""}`}>
                    <CardView card={c} />
                    <span className={styles.lookName}>{c.name}</span>
                    <div className={styles.lookActions}>
                      {lookKind === "scry" && (
                        <>
                          <button type="button" className={styles.ghost} onClick={() => setScryN((cur) => {
                            if (!cur) return cur;
                            const i = cur.findIndex((x) => x.instanceId === c.instanceId);
                            if (i <= 0) return cur;
                            const next = [...cur];
                            const [m] = next.splice(i, 1);
                            next.splice(i - 1, 0, m);
                            return next;
                          })}>◀</button>
                          <button type="button" className={styles.ghost} onClick={() => setScryN((cur) => {
                            if (!cur) return cur;
                            const i = cur.findIndex((x) => x.instanceId === c.instanceId);
                            if (i < 0 || i >= cur.length - 1) return cur;
                            const next = [...cur];
                            const [m] = next.splice(i, 1);
                            next.splice(i + 1, 0, m);
                            return next;
                          })}>▶</button>
                          <button type="button" className={styles.ghost} onClick={() => {
                            dispatch({
                              type: "scry",
                              seatId: seat.id,
                              keepTop: scryN.filter((x) => x.instanceId !== c.instanceId).map((x) => x.instanceId),
                              bottom: [c.instanceId],
                            });
                            setScryN((cur) => cur?.filter((x) => x.instanceId !== c.instanceId) ?? null);
                          }}>Bottom</button>
                          <button type="button" className={styles.ghost} onClick={() => {
                            dispatch({
                              type: "scry",
                              seatId: seat.id,
                              keepTop: scryN.filter((x) => x.instanceId !== c.instanceId).map((x) => x.instanceId),
                              bottom: [],
                              grave: [c.instanceId],
                            });
                            setScryN((cur) => cur?.filter((x) => x.instanceId !== c.instanceId) ?? null);
                          }}>Grave</button>
                        </>
                      )}
                      {lookKind === "searchTop" && (
                        <>
                          <button type="button" className={styles.ghost} onClick={() => dispatch({ type: "move", seatId: seat.id, instanceId: c.instanceId, to: "hand" })}>Hand</button>
                          <button type="button" className={styles.ghost} onClick={() => dispatch({ type: "move", seatId: seat.id, instanceId: c.instanceId, to: "battlefield" })}>Play</button>
                        </>
                      )}
                      {(lookKind === "cascade" || lookKind === "discover") && cascadeHit === c.instanceId && (
                        <>
                          <button type="button" className={styles.primary} onClick={() => {
                            const rest = scryN.filter((x) => x.instanceId !== c.instanceId);
                            dispatch({ type: "cast", instanceId: c.instanceId });
                            if (lookKind === "discover") {
                              dispatch({ type: "bottomRandom", seatId: seat.id, instanceIds: rest.map((x) => x.instanceId) });
                            } else {
                              dispatch({ type: "moveMany", seatId: seat.id, instanceIds: rest.map((x) => x.instanceId), to: "library" });
                            }
                            setScryN(null);
                          }}>Cast</button>
                          <button type="button" className={styles.ghost} onClick={() => {
                            const ids = scryN.map((x) => x.instanceId);
                            if (lookKind === "discover") dispatch({ type: "bottomRandom", seatId: seat.id, instanceIds: ids });
                            else dispatch({ type: "moveMany", seatId: seat.id, instanceIds: ids, to: "library" });
                            setScryN(null);
                          }}>All bottom</button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {lookKind === "discover" && !cascadeHit && (
                <button type="button" className={styles.btn} onClick={() => {
                  dispatch({ type: "bottomRandom", seatId: seat.id, instanceIds: scryN.map((x) => x.instanceId) });
                  setScryN(null);
                }}>
                  Bottom in random order
                </button>
              )}
              {lookKind === "scry" && (
                <button type="button" className={styles.primary} onClick={() => {
                  dispatch({
                    type: "scry",
                    seatId: seat.id,
                    keepTop: scryN.map((c) => c.instanceId),
                    bottom: [],
                  });
                  setScryN(null);
                }}>
                  Done
                </button>
              )}
              {lookKind !== "scry" && (
                <button type="button" className={styles.primary} onClick={() => setScryN(null)}>Close</button>
              )}
            </div>
          </div>
        )}

        {kit && (
          <div className={styles.kit} onClick={(e) => e.stopPropagation()}>
            <div className={styles.pileHead}>
              <span>Table kit</span>
              <button type="button" className={styles.ghost} onClick={() => setKit(null)}>Close</button>
            </div>
            <div className={styles.kitTabs}>
              {(["tokens", "side", "spawn"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  className={kit.tab === tab ? styles.primary : styles.btn}
                  onClick={() => setKit({ kind: tab, tab })}
                >
                  {tab === "side" ? "Sideboard" : tab === "spawn" ? "Spawn" : "Tokens"}
                </button>
              ))}
            </div>
            {kit.tab === "tokens" &&
              tokens.filter((t) => t.included).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={styles.ghost}
                  onClick={() =>
                    dispatch({
                      type: "addToken",
                      seatId: seat.id,
                      card: {
                        oracleId: t.oracle_id || t.id,
                        scryfallId: t.id,
                        name: t.name,
                        typeLine: t.type_line,
                        manaCost: "",
                        image: t.image,
                        face: 0,
                        tapped: false,
                        facedown: false,
                        counters: {},
                        token: true,
                        controllerSeat: seat.id,
                      },
                    })
                  }
                >
                  {t.name}
                </button>
              ))}
            {kit.tab === "side" &&
              seat.zones.sideboard.map((c) => (
                <button
                  key={c.instanceId}
                  type="button"
                  className={styles.ghost}
                  onClick={() => dispatch({ type: "move", seatId: seat.id, instanceId: c.instanceId, to: "hand" })}
                >
                  {c.name}
                </button>
              ))}
            {kit.tab === "spawn" && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!spawnQ.trim()) return;
                  const { card } = await fetchNamedCard(spawnQ.trim());
                  if (!card) return;
                  const oid = card.oracle_id || card.id;
                  const front = (await resolveImageUrl(oid, card.id, 0)) || getFaceImage(card, 0);
                  dispatch({
                    type: "addToken",
                    seatId: seat.id,
                    card: {
                      oracleId: oid,
                      scryfallId: card.id,
                      name: card.name,
                      typeLine: card.type_line || "",
                      manaCost: card.mana_cost || "",
                      image: front || undefined,
                      face: 0,
                      tapped: false,
                      facedown: false,
                      counters: {},
                      token: false,
                      controllerSeat: seat.id,
                    },
                  });
                  setSpawnQ("");
                }}
              >
                <input
                  className={styles.btn}
                  placeholder="Card name…"
                  value={spawnQ}
                  onChange={(e) => setSpawnQ(e.target.value)}
                />
                <button type="submit" className={styles.primary}>Spawn</button>
              </form>
            )}
          </div>
        )}

        {settingsOpen && (
          <div className={styles.overlay} onClick={() => setSettingsOpen(false)}>
            <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
              <h2>Table settings</h2>
              <label className={styles.setting}>
                Mulligan
                <select
                  value={settings.mulligan}
                  onChange={(e) =>
                    persist({ ...settings, mulligan: e.target.value as PlaySettings["mulligan"] })
                  }
                >
                  <option value="london">London (draw 7, bottom N)</option>
                  <option value="paris">Paris (draw one fewer)</option>
                  <option value="free">Free (draw 7 again)</option>
                </select>
              </label>
              <label className={styles.setting}>
                Opening hand
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={settings.openingHand}
                  onChange={(e) => persist({ ...settings, openingHand: Number(e.target.value) || 7 })}
                />
              </label>
              <label className={styles.setting}>
                Starting life (blank = format)
                <input
                  type="number"
                  min={1}
                  value={settings.startingLife ?? ""}
                  onChange={(e) =>
                    persist({
                      ...settings,
                      startingLife: e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                />
              </label>
              <label className={styles.setting}>
                Draw count
                <input
                  type="number"
                  min={1}
                  value={settings.drawCount}
                  onChange={(e) => persist({ ...settings, drawCount: Number(e.target.value) || 1 })}
                />
              </label>
              <label className={styles.setting}>
                Scry count
                <input
                  type="number"
                  min={1}
                  value={settings.scryCount}
                  onChange={(e) => persist({ ...settings, scryCount: Number(e.target.value) || 1 })}
                />
              </label>
              <label className={styles.setting}>
                Mill count
                <input
                  type="number"
                  min={1}
                  value={settings.millCount}
                  onChange={(e) => persist({ ...settings, millCount: Number(e.target.value) || 1 })}
                />
              </label>
              <label className={styles.setting}>
                Next turn draws
                <input
                  type="number"
                  min={0}
                  value={settings.nextTurnDraw}
                  onChange={(e) => persist({ ...settings, nextTurnDraw: Number(e.target.value) || 0 })}
                />
              </label>
              <label className={styles.setting}>
                <input
                  type="checkbox"
                  checked={settings.nextTurnUntap}
                  onChange={(e) => persist({ ...settings, nextTurnUntap: e.target.checked })}
                />
                Next turn untaps
              </label>
              <label className={styles.setting}>
                <input
                  type="checkbox"
                  checked={settings.showXGlyph}
                  onChange={(e) => persist({ ...settings, showXGlyph: e.target.checked })}
                />
                Show X on actions (off = show the number)
              </label>
              <label className={styles.setting}>
                Board card size
                <select
                  value={String(settings.boardScale ?? 1)}
                  onChange={(e) => persist({ ...settings, boardScale: Number(e.target.value) })}
                >
                  <option value="0.85">Small</option>
                  <option value="1">Normal</option>
                  <option value="1.2">Large</option>
                  <option value="1.4">XL</option>
                </select>
              </label>
              <label className={styles.setting}>
                Hand card size
                <select
                  value={String(settings.handScale ?? 1)}
                  onChange={(e) => persist({ ...settings, handScale: Number(e.target.value) })}
                >
                  <option value="0.85">Small</option>
                  <option value="1">Normal</option>
                  <option value="1.15">Large</option>
                </select>
              </label>
              <label className={styles.setting}>
                Playmat
                <select
                  value={settings.playmat ?? "felt"}
                  onChange={(e) => persist({ ...settings, playmat: e.target.value as PlaySettings["playmat"] })}
                >
                  <option value="felt">Felt</option>
                  <option value="arcane">Arcane</option>
                  <option value="plain">Plain</option>
                </select>
              </label>
              <label className={styles.setting}>
                <input
                  type="checkbox"
                  checked={settings.hideHand}
                  onChange={(e) => persist({ ...settings, hideHand: e.target.checked })}
                />
                Hide hand (streamer)
              </label>
              {(["autoTap", "death", "tax", "legend"] as const).map((key) => (
                <label key={key} className={styles.setting}>
                  <input
                    type="checkbox"
                    checked={settings.assistants?.[key] !== false}
                    onChange={(e) => persist({ ...settings, assistants: { ...settings.assistants, [key]: e.target.checked } })}
                  />
                  Assistant: {key}
                </label>
              ))}
              <button type="button" className={styles.primary} onClick={() => setSettingsOpen(false)}>
                Close
              </button>
            </div>
          </div>
        )}

        {marquee && (
          <div
            className={styles.marquee}
            style={{
              left: Math.min(marquee.x0, marquee.x1),
              top: Math.min(marquee.y0, marquee.y1),
              width: Math.abs(marquee.x1 - marquee.x0),
              height: Math.abs(marquee.y1 - marquee.y0),
            }}
          />
        )}

        {altPeek && hoverCard && enhanceList.length === 0 && (
          <div className={styles.peek}>
            <img
              src={cardImage(hoverCard) || hoverCard.image}
              alt={hoverCard.name}
              className={styles.peekImg}
            />
          </div>
        )}

        {enhanceList.length > 0 && (
          <div className={styles.overlay} onClick={() => setEnhanceList([])}>
            {enhanceList.length === 1 ? (
              <div className={styles.enhanceSolo} onClick={(e) => e.stopPropagation()}>
                <button type="button" className={styles.primary} onClick={() => setEnhanceList([])}>Close</button>
                <div className={styles.enhance}>
                  <TiltFace enabled>
                    {enhanceList[0].facedown ? (
                      <span className={styles.sleeveBig} />
                    ) : (
                      <img src={cardImage(enhanceList[0]) || enhanceList[0].image} alt={enhanceList[0].name} className={styles.enhanceSoloImg} />
                    )}
                  </TiltFace>
                </div>
              </div>
            ) : (
              <div className={styles.enhanceStage} onClick={(e) => e.stopPropagation()}>
                <div className={styles.enhanceToolbar}>
                  <span>{enhanceList.length} cards</span>
                  <button type="button" className={styles.primary} onClick={() => setEnhanceList([])}>Close</button>
                </div>
                <div className={styles.enhanceGrid}>
                  {enhanceList.map((card) => (
                    <div key={card.instanceId} className={styles.enhance}>
                      <TiltFace enabled>
                        {card.facedown ? (
                          <span className={styles.sleeveBig} />
                        ) : (
                          <img src={cardImage(card) || card.image} alt={card.name} className={styles.enhanceImg} />
                        )}
                      </TiltFace>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {inspect && (
          <CardInspectorModal
            scryfallId={inspect.scryfallId}
            name={inspect.name}
            imageUrl={inspect.image}
            onClose={() => setInspect(null)}
          />
        )}
      </div>
      <DragOverlay dropAnimation={null}>
        {activeDrag ? (
          <div className={`${styles.card} ${styles.overlayCard}`}>
            {cardImage(activeDrag) ? (
              <img src={cardImage(activeDrag)} alt="" className={styles.cardImg} />
            ) : (
              <span className={styles.cardFace}>{activeDrag.name}</span>
            )}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
