import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
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
import {
  DEFAULT_PLAY_SETTINGS,
  clearLiveTable,
  loadLiveTable,
  loadPlaySettings,
  saveLiveTable,
  savePlaySettings,
  type PlaySettings,
} from "../lib/playtest/settings";
import type { PlayAction, PlayCard, PlayZone, TableState } from "../lib/playtest/types";
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

function clampMenu(x: number, y: number, w = 188, h = 260) {
  const pad = 8;
  const left = Math.min(window.innerWidth - w - pad, Math.max(pad, x));
  const top = Math.min(window.innerHeight - h - pad, Math.max(pad, y));
  const flyLeft = left + w + 168 > window.innerWidth;
  return { x: left, y: top, flyLeft };
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

function PlayFace({
  card,
  selected,
  onActivate,
  onMenu,
  onGrab,
  onHover,
  onDoubleClick,
  style,
}: {
  card: PlayCard;
  selected: boolean;
  onActivate: (e: ReactMouseEvent) => void;
  onMenu: (e: ReactMouseEvent) => void;
  onGrab?: (e: ReactMouseEvent) => void;
  onHover?: (card: PlayCard | null) => void;
  onDoubleClick?: (e: ReactMouseEvent) => void;
  style?: CSSProperties;
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
      className={`${styles.card}${card.tapped ? ` ${styles.tapped}` : ""}${
        selected ? ` ${styles.selected}` : ""
      }${isDragging ? ` ${styles.dragging}` : ""}`}
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
    </button>
  );
}

function ZoneDrop({
  zone,
  row,
  className,
  children,
  innerRef,
}: {
  zone: PlayZone;
  row?: "field" | "lands";
  className?: string;
  children: ReactNode;
  innerRef?: Ref<HTMLDivElement>;
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
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [kit, setKit] = useState<null | { kind: "tokens" | "side" | "spawn"; tab: "tokens" | "side" | "spawn" }>(null);
  const [libX, setLibX] = useState(1);
  const [spawnQ, setSpawnQ] = useState("");
  const [menu, setMenu] = useState<{ x: number; y: number; flyLeft?: boolean; card: PlayCard } | null>(null);
  const [inspect, setInspect] = useState<PlayCard | null>(null);
  const [searchZone, setSearchZone] = useState<PlayZone | null>(null);
  const [scryN, setScryN] = useState<PlayCard[] | null>(null);
  const [lookKind, setLookKind] = useState<"scry" | "searchTop" | "cascade" | "delve">("scry");
  const [cascadeHit, setCascadeHit] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [settings, setSettings] = useState<PlaySettings>(DEFAULT_PLAY_SETTINGS);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [countsOpen, setCountsOpen] = useState(false);
  const [countsLocked, setCountsLocked] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [libMenu, setLibMenu] = useState<{ x: number; y: number } | null>(null);
  const [tableMenu, setTableMenu] = useState<{ x: number; y: number } | null>(null);
  const [coin, setCoin] = useState<string | null>(null);
  const [activeDrag, setActiveDrag] = useState<PlayCard | null>(null);
  const [enhanceList, setEnhanceList] = useState<PlayCard[]>([]);
  const [hoverCard, setHoverCard] = useState<PlayCard | null>(null);
  const [altPeek, setAltPeek] = useState(false);
  const [libSlot, setLibSlot] = useState(1);
  const [libDestOpen, setLibDestOpen] = useState(false);
  const hoverRef = useRef<PlayCard | null>(null);
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

  const dispatch = useCallback((action: PlayAction) => {
    setTable((cur) => {
      if (!cur && action.type !== "hydrate") return cur;
      const base = action.type === "hydrate" ? action.state : cur!;
      if (action.type !== "hydrate") {
        history.current = [...history.current.slice(-39), cur!];
      }
      const next = reducePlay(base, action);
      if (next.deckId) saveLiveTable(next.deckId, next);
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
      if (live?.started) {
        dispatch({ type: "hydrate", state: live });
        setLoading(false);
        return;
      }
    } else {
      clearLiveTable(id);
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

  useEffect(() => {
    void start();
  }, [start]);

  useEffect(() => {
    function close() {
      setMenu(null);
      setTableMenu(null);
      setMoveOpen(false);
      setLibMenu(null);
      if (!countsLocked) setCountsOpen(false);
    }
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [countsLocked]);

  useEffect(() => {
    function move(e: PointerEvent) {
      ptrRef.current = { x: e.clientX, y: e.clientY };
    }
    window.addEventListener("pointermove", move);
    return () => window.removeEventListener("pointermove", move);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!table) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const seat = table.seats[0];
      if (e.key === "d" || e.key === "D") {
        dispatch({ type: "draw", seatId: seat.id, n: settings.drawCount });
      }
      if (e.key === "n" || e.key === "N") {
        dispatch({
          type: "nextTurn",
          untap: settings.nextTurnUntap,
          draw: settings.nextTurnDraw,
        });
      }
      if (e.key === "u" || e.key === "U") {
        const prev = history.current.pop();
        if (prev) setTable(prev);
      }
      if (e.key === "e" || e.key === "E") {
        const card = hoverRef.current;
        const ids = card
          ? picked.includes(card.instanceId) && picked.length > 1
            ? picked
            : [card.instanceId]
          : selected
            ? picked.includes(selected) && picked.length > 1
              ? picked
              : [selected]
            : [];
        ids.forEach((id) => dispatch({ type: "tap", instanceId: id }));
      }
      if (e.key === "Alt") setAltPeek(true);
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
  }, [dispatch, picked, selected, settings, table]);

  const seat = table?.seats[0];
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

  function targets(id: string) {
    if (picked.includes(id) && picked.length > 1) return picked;
    return [id];
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

  function CardView({ card, style }: { card: PlayCard; style?: CSSProperties }) {
    return (
      <PlayFace
        card={card}
        selected={selected === card.instanceId || picked.includes(card.instanceId)}
        style={style}
        onHover={(c) => {
          hoverRef.current = c;
          setHoverCard(c);
        }}
        onDoubleClick={() => {
          targets(card.instanceId).forEach((id) => dispatch({ type: "tap", instanceId: id }));
        }}
        onActivate={(ev) => {
          if (ev.altKey) {
            const ids = targets(card.instanceId);
            const all = Object.values(seat?.zones ?? {}).flat();
            setEnhanceList(ids.map((id) => all.find((x) => x.instanceId === id)).filter((x): x is PlayCard => Boolean(x)));
            return;
          }
          if (ev.ctrlKey || ev.metaKey) {
            setPicked((cur) =>
              cur.includes(card.instanceId)
                ? cur.filter((id) => id !== card.instanceId)
                : [...cur, card.instanceId]
            );
            setSelected(card.instanceId);
            return;
          }
          setPicked([card.instanceId]);
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
          setSelected(card.instanceId);
          if (!picked.includes(card.instanceId)) setPicked([card.instanceId]);
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
            <CardView card={top} />
          ) : stacked ? (
            <span className={styles.hint}>Empty</span>
          ) : (
            cards.slice(-3).map((c) => <CardView key={c.instanceId} card={c} />)
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
        onContextMenu={(e) => {
          const t = e.target as HTMLElement;
          if (t.closest("button") || t.closest("a") || t.closest("input") || t.closest(`.${styles.card}`)) return;
          e.preventDefault();
          setMenu(null);
          setTableMenu(clampMenu(e.clientX, e.clientY, 200, 340));
        }}
      >
        <div className={styles.top}>
          <Link to={`/deck/${id}`} className={styles.back}>
            ← {table.deckName}
          </Link>
          <h1 className={styles.title}>Playtest</h1>
          <span className={styles.muted}>
            Turn {table.turn} · {table.format} · {settings.mulligan} mulligan
          </span>
          <button type="button" className={styles.btn} onClick={() => setSettingsOpen(true)}>
            Table settings
          </button>
          <button type="button" className={styles.btn} onClick={() => setKit({ kind: "tokens", tab: "tokens" })}>
            Tokens
          </button>
          <button type="button" className={styles.btn} onClick={() => setKit({ kind: "side", tab: "side" })}>
            Sideboard
          </button>
          <button type="button" className={styles.btn} onClick={() => setKit({ kind: "spawn", tab: "spawn" })}>
            Spawn
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
            <button type="button" className={styles.btn} onClick={() => setLogOpen((v) => !v)}>
              {logOpen ? "Hide log" : "Log"}
            </button>
            <button type="button" className={styles.primary} onClick={() => void start(true)}>
              New game
            </button>
          </div>
        </div>


        <div className={styles.board}>
          <div className={styles.battlefield} ref={bfRef}>
            <div className={styles.pileHead}>
              <span>Battlefield</span>
              <span>
                {seat.zones.battlefield.filter((c) => c.row !== "lands").length}
              </span>
            </div>
            <ZoneDrop zone="battlefield" row="field" className={styles.bfField} innerRef={fieldRef}>
              <span ref={ghostRef} className={styles.gridGhost} style={{ display: "none" }} />
              {seat.zones.battlefield
                .filter((c) => c.row !== "lands")
                .map((c) => (
                  <CardView
                    key={c.instanceId}
                    card={c}
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
              {seat.zones.stack.map((c) => (
                <CardView key={c.instanceId} card={c} />
              ))}
            </ZoneDrop>
            <ZoneDrop zone="battlefield" row="lands" className={styles.landRail}>
              <div className={styles.railHead}>
                <span className={styles.railCount}>
                  {seat.zones.battlefield.filter((c) => c.row === "lands").length}
                </span>
                <span className={styles.railLabel}>Lands</span>
              </div>
              <div className={styles.railScroll} ref={landScroll}>
                {Object.values(
                  seat.zones.battlefield
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
            <Pile zone="command" label="Command" />
            <Pile zone="exile" label="Exile" />
            <Pile zone="graveyard" label="GY" />
            <Pile zone="library" label="Library" />
          </div>
        </div>

        <ZoneDrop zone="hand" className={styles.hand}>
          <div className={styles.pileHead}>
            <span>Hand</span>
            <span>{seat.zones.hand.length}</span>
          </div>
          <div className={styles.handRow} ref={handScroll}>
            {seat.zones.hand.map((c) => (
              <CardView key={c.instanceId} card={c} />
            ))}
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
          <div
            className={styles.menu}
            style={{ left: menu.x, top: menu.y }}
            onClick={(e) => e.stopPropagation()}
          >
            <button type="button" onClick={() => {
              targets(menu.card.instanceId).forEach((id) => dispatch({ type: "tap", instanceId: id }));
              setMenu(null);
            }}>
              Tap / untap
            </button>
            <button type="button" onClick={() => {
              const ids = targets(menu.card.instanceId);
              const all = Object.values(seat.zones).flat();
              setEnhanceList(ids.map((id) => all.find((x) => x.instanceId === id)).filter((x): x is PlayCard => Boolean(x)));
              setMenu(null);
            }}>
              Enhance
            </button>
            <button type="button" onClick={() => { dispatch({ type: "facedown", instanceId: menu.card.instanceId }); setMenu(null); }}>
              Flip card
            </button>
            <button type="button" onClick={() => { dispatch({ type: "flip", instanceId: menu.card.instanceId }); setMenu(null); }}>
              Switch face
            </button>
            <button type="button" onClick={() => {
              targets(menu.card.instanceId).forEach((id) => dispatch({ type: "clone", instanceId: id }));
              setMenu(null);
            }}>
              Make Token Copy
            </button>
            <button type="button" onClick={() => {
              targets(menu.card.instanceId).forEach((id) => dispatch({ type: "remove", instanceId: id }));
              setPicked([]);
              setMenu(null);
            }}>
              Remove from table
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setMoveOpen((v) => !v);
              }}
            >
              Move to ▸
            </button>
            {moveOpen && (
              <div
                className={styles.flyout}
                style={{
                  left: "flyLeft" in menu && menu.flyLeft ? "auto" : "100%",
                  right: "flyLeft" in menu && menu.flyLeft ? "100%" : "auto",
                }}
              >
                {MOVE_ZONES.map((z) => (
                  z.id === "library" ? (
                    <div key={z.id} className={styles.menuNested}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setLibDestOpen((v) => !v);
                        }}
                      >
                        Library ▸
                      </button>
                      {libDestOpen && (
                        <div className={styles.flyout2}>
                          <button type="button" onClick={() => {
                            targets(menu.card.instanceId).forEach((id, i) =>
                              dispatch({ type: "move", seatId: seat.id, instanceId: id, to: "library", index: i })
                            );
                            setMenu(null); setMoveOpen(false); setLibDestOpen(false);
                          }}>Top</button>
                          <button type="button" onClick={() => {
                            targets(menu.card.instanceId).forEach((id) =>
                              dispatch({ type: "move", seatId: seat.id, instanceId: id, to: "library" })
                            );
                            setMenu(null); setMoveOpen(false); setLibDestOpen(false);
                          }}>Bottom</button>
                          <button type="button" onClick={() => {
                            const slot = Math.max(1, libSlot) - 1;
                            targets(menu.card.instanceId).forEach((id, i) =>
                              dispatch({ type: "move", seatId: seat.id, instanceId: id, to: "library", index: slot + i })
                            );
                            setMenu(null); setMoveOpen(false); setLibDestOpen(false);
                          }}>
                            Slot {libSlot} from top
                          </button>
                          <input
                            className={styles.slotInput}
                            type="number"
                            min={1}
                            value={libSlot}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => setLibSlot(Number(e.target.value) || 1)}
                          />
                          <button type="button" onClick={() => {
                            targets(menu.card.instanceId).forEach((id) =>
                              dispatch({ type: "move", seatId: seat.id, instanceId: id, to: "library" })
                            );
                            dispatch({ type: "shuffle", seatId: seat.id });
                            setMenu(null); setMoveOpen(false); setLibDestOpen(false);
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
                      setMenu(null);
                      setMoveOpen(false);
                    }}
                  >
                    {z.label}
                  </button>
                  )
                ))}
              </div>
            )}
            <button type="button" onClick={() => { setInspect(menu.card); setMenu(null); }}>
              Inspect
            </button>
          </div>
        )}

        {tableMenu && (
          <div className={styles.menu} style={{ left: tableMenu.x, top: tableMenu.y }} onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={() => { dispatch({ type: "draw", seatId: seat.id, n: settings.drawCount }); setTableMenu(null); }}>Draw</button>
            <button type="button" onClick={() => { dispatch({ type: "mulligan", seatId: seat.id, kind: settings.mulligan }); setTableMenu(null); }}>Mulligan</button>
            <button type="button" onClick={() => { dispatch({ type: "nextTurn", untap: settings.nextTurnUntap, draw: settings.nextTurnDraw }); setTableMenu(null); }}>Next turn</button>
            <button type="button" onClick={() => { dispatch({ type: "shuffle", seatId: seat.id }); setTableMenu(null); }}>Shuffle</button>
            <button type="button" onClick={() => { dispatch({ type: "mill", seatId: seat.id, n: settings.millCount }); setTableMenu(null); }}>Mill</button>
            <button type="button" onClick={() => { setLookKind("scry"); setScryN(seat.zones.library.slice(0, settings.scryCount)); setTableMenu(null); }}>Scry</button>
            <button type="button" onClick={() => { history.current.pop(); const prev = history.current[history.current.length - 1]; if (prev) dispatch({ type: "hydrate", state: prev }); setTableMenu(null); }}>Undo</button>
            <button type="button" onClick={() => { dispatch({ type: "log", text: `d20 = ${roll(20)}` }); setTableMenu(null); }}>Roll d20</button>
            <button
              type="button"
              onClick={() => {
                const face = Math.random() < 0.5 ? "Heads" : "Tails";
                setCoin(face);
                dispatch({ type: "log", text: `Coin: ${face}` });
                setTableMenu(null);
              }}
            >
              Flip a coin
            </button>
            <button type="button" onClick={() => { setKit({ kind: "tokens", tab: "tokens" }); setTableMenu(null); }}>Tokens</button>
            <button type="button" onClick={() => { setKit({ kind: "side", tab: "side" }); setTableMenu(null); }}>Sideboard</button>
            <button type="button" onClick={() => { setSettingsOpen(true); setTableMenu(null); }}>Settings</button>
          </div>
        )}

        {libMenu && (
          <div
            className={styles.menu}
            style={{ left: libMenu.x, top: libMenu.y }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.menuRow}>
              <button
                type="button"
                onClick={() => {
                  dispatch({ type: "draw", seatId: seat.id, n: libX });
                  setLibMenu(null);
                }}
              >
                Draw {libX}
              </button>
              <button type="button" className={styles.countChip} onClick={(e) => { e.stopPropagation(); setLibX((n) => n + stepFromEvent(e)); }} onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setLibX((n) => Math.max(1, n - stepFromEvent(e))); }}>
                {libX}
              </button>
            </div>
            <button type="button" onClick={() => { setSearchZone("library"); setLibMenu(null); }}>
              Search
            </button>
            <button type="button" onClick={() => { setLookKind("searchTop"); setScryN(seat.zones.library.slice(0, libX)); setLibMenu(null); }}>
              Search {libX}
            </button>
            <button type="button" onClick={() => { setLookKind("scry"); setScryN(seat.zones.library.slice(0, settings.scryCount)); setLibMenu(null); }}>
              Scry {settings.scryCount}
            </button>
            <button type="button" onClick={() => { dispatch({ type: "mill", seatId: seat.id, n: libX }); setLibMenu(null); }}>
              Mill {libX}
            </button>
            <button type="button" onClick={() => { dispatch({ type: "exileTop", seatId: seat.id, n: libX }); setLibMenu(null); }}>
              Exile {libX}
            </button>
            <button type="button" onClick={() => {
              const revealed: PlayCard[] = [];
              let hit: string | null = null;
              for (const c of seat.zones.library) {
                revealed.push(c);
                const land = /\bland\b/i.test(c.typeLine);
                if (!land && manaValue(c) < libX) {
                  hit = c.instanceId;
                  break;
                }
              }
              setLookKind("cascade");
              setCascadeHit(hit);
              setScryN(revealed);
              setLibMenu(null);
            }}>
              Cascade {libX}
            </button>
            <button type="button" onClick={() => {
              setLookKind("delve");
              setScryN(seat.zones.graveyard.slice(0, Math.max(seat.zones.graveyard.length, libX)));
              setLibMenu(null);
            }}>
              Delve {libX}
            </button>
            <button type="button" onClick={() => { dispatch({ type: "shuffle", seatId: seat.id }); setLibMenu(null); }}>
              Shuffle
            </button>
            {["Plains", "Island", "Swamp", "Mountain", "Forest", "Wastes"]
              .map((name) =>
                Object.values(seat.zones)
                  .flat()
                  .find((c) => c.name === name)
              )
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
                      <div className={styles.lookActions}>
                        <button type="button" className={styles.ghost} onClick={() => dispatch({ type: "move", seatId: seat.id, instanceId: c.instanceId, to: "hand" })}>Hand</button>
                        <button type="button" className={styles.ghost} onClick={() => dispatch({ type: "move", seatId: seat.id, instanceId: c.instanceId, to: "battlefield" })}>Play</button>
                        {searchZone === "library" && (
                          <button type="button" className={styles.ghost} onClick={() => {
                            dispatch({ type: "move", seatId: seat.id, instanceId: c.instanceId, to: "hand" });
                            dispatch({ type: "shuffle", seatId: seat.id });
                          }}>Take & shuffle</button>
                        )}
                      </div>
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
                {lookKind === "cascade" ? `Cascade ${libX}` : lookKind === "delve" ? `Delve ${libX}` : lookKind === "searchTop" ? `Top ${scryN.length}` : `Scry ${scryN.length}`}
              </h2>
              {lookKind === "cascade" && (
                <p className={styles.hint}>
                  {cascadeHit ? "Nonland found. Cast it or leave it; the rest go to the bottom." : "No nonland cheaper than X. Revealed cards go to the bottom."}
                </p>
              )}
              {lookKind === "delve" && <p className={styles.hint}>Exile cards from the graveyard (up to {libX}), or exile the top {libX} of the library.</p>}
              {lookKind === "scry" && <p className={styles.hint}>Keep on top or send to the bottom, then Done.</p>}
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
                            next.unshift(m);
                            return next;
                          })}>Top</button>
                          <button type="button" className={styles.ghost} onClick={() => {
                            dispatch({
                              type: "scry",
                              seatId: seat.id,
                              keepTop: scryN.filter((x) => x.instanceId !== c.instanceId).map((x) => x.instanceId),
                              bottom: [c.instanceId],
                            });
                            setScryN((cur) => cur?.filter((x) => x.instanceId !== c.instanceId) ?? null);
                          }}>Bottom</button>
                        </>
                      )}
                      {lookKind === "searchTop" && (
                        <>
                          <button type="button" className={styles.ghost} onClick={() => dispatch({ type: "move", seatId: seat.id, instanceId: c.instanceId, to: "hand" })}>Hand</button>
                          <button type="button" className={styles.ghost} onClick={() => dispatch({ type: "move", seatId: seat.id, instanceId: c.instanceId, to: "battlefield" })}>Play</button>
                        </>
                      )}
                      {lookKind === "cascade" && cascadeHit === c.instanceId && (
                        <>
                          <button type="button" className={styles.primary} onClick={() => {
                            const rest = scryN.filter((x) => x.instanceId !== c.instanceId);
                            dispatch({ type: "move", seatId: seat.id, instanceId: c.instanceId, to: "stack" });
                            rest.forEach((x) => dispatch({ type: "move", seatId: seat.id, instanceId: x.instanceId, to: "library" }));
                            setScryN(null);
                          }}>Cast</button>
                          <button type="button" className={styles.ghost} onClick={() => {
                            scryN.forEach((x) => dispatch({ type: "move", seatId: seat.id, instanceId: x.instanceId, to: "library" }));
                            setScryN(null);
                          }}>All bottom</button>
                        </>
                      )}
                      {lookKind === "delve" && (
                        <button type="button" className={styles.ghost} onClick={() => dispatch({ type: "move", seatId: seat.id, instanceId: c.instanceId, to: "exile" })}>
                          Exile
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {lookKind === "delve" && (
                <button type="button" className={styles.btn} onClick={() => {
                  dispatch({ type: "exileTop", seatId: seat.id, n: libX });
                  setScryN(null);
                }}>
                  Exile top {libX} of library
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
              <button type="button" className={styles.primary} onClick={() => setSettingsOpen(false)}>
                Close
              </button>
            </div>
          </div>
        )}

        {altPeek && hoverCard && enhanceList.length === 0 && (
          <div className={styles.peek} onPointerDown={(e) => e.preventDefault()}>
            <img
              src={cardImage(hoverCard) || hoverCard.image}
              alt={hoverCard.name}
              className={styles.peekImg}
            />
          </div>
        )}

        {enhanceList.length > 0 && (
          <div className={styles.overlay} onClick={() => setEnhanceList([])}>
            <div
              className={enhanceList.length > 3 ? styles.enhanceGrid : styles.enhanceRow}
              onClick={(e) => e.stopPropagation()}
            >
              {enhanceList.map((card) => (
                <div key={card.instanceId} className={styles.enhance}>
                  <TiltFace enabled>
                    {card.facedown ? (
                      <span className={styles.sleeveBig} />
                    ) : (
                      <img
                        src={cardImage(card) || card.image}
                        alt={card.name}
                        className={styles.enhanceImg}
                      />
                    )}
                  </TiltFace>
                </div>
              ))}
            </div>
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
