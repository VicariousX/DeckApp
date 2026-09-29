import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
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
import { fetchCollectionByIds } from "../lib/scryfallApi";
import { getFaceImage } from "../utils/scryfall";
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
  loadPlaySettings,
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
  { id: "library", label: "Library (top)" },
  { id: "command", label: "Command" },
  { id: "sideboard", label: "Sideboard" },
  { id: "stack", label: "Stack" },
];

function roll(sides: number) {
  return 1 + Math.floor(Math.random() * sides);
}

function PlayFace({
  card,
  selected,
  onSelect,
  onTap,
  onMenu,
  onCounter,
}: {
  card: PlayCard;
  selected: boolean;
  onSelect: () => void;
  onTap: () => void;
  onMenu: (e: ReactMouseEvent) => void;
  onCounter: (delta: number) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: card.instanceId,
    data: { card },
  });
  const src = cardImage(card);
  const plus = Object.values(card.counters).reduce((a, b) => a + b, 0);
  return (
    <button
      type="button"
      ref={setNodeRef}
      className={`${styles.card}${card.tapped ? ` ${styles.tapped}` : ""}${
        selected ? ` ${styles.selected}` : ""
      }${isDragging ? ` ${styles.dragging}` : ""}`}
      style={isDragging ? { opacity: 0.35 } : undefined}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onTap();
      }}
      onContextMenu={onMenu}
      {...listeners}
      {...attributes}
    >
      <TiltFace enabled={!isDragging}>
        {src ? (
          <RateLimitedImg src={src} alt={card.name} className={styles.cardImg} />
        ) : (
          <span className={styles.cardFace}>{card.facedown ? "Facedown" : card.name}</span>
        )}
      </TiltFace>
      <span
        className={styles.badge}
        onClick={(e) => {
          e.stopPropagation();
          onCounter(1);
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onCounter(-1);
        }}
      >
        {plus || "+"}
      </span>
    </button>
  );
}

function ZoneDrop({
  zone,
  className,
  children,
}: {
  zone: PlayZone;
  className?: string;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `zone:${zone}`,
    data: { zone },
  });
  return (
    <div
      ref={setNodeRef}
      className={`${className ?? ""}${isOver ? ` ${styles.dropOver}` : ""}`}
    >
      {children}
    </div>
  );
}

export function PlaytestPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [table, setTable] = useState<TableState | null>(null);
  const history = useRef<TableState[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; card: PlayCard } | null>(null);
  const [inspect, setInspect] = useState<PlayCard | null>(null);
  const [searchZone, setSearchZone] = useState<PlayZone | null>(null);
  const [scryN, setScryN] = useState<PlayCard[] | null>(null);
  const [filter, setFilter] = useState("");
  const [settings, setSettings] = useState<PlaySettings>(DEFAULT_PLAY_SETTINGS);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [stepper, setStepper] = useState<"draw" | "scry" | "mill" | null>(null);
  const [activeDrag, setActiveDrag] = useState<PlayCard | null>(null);

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
      return reducePlay(base, action);
    });
  }, []);

  const start = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    const prefs = loadPlaySettings();
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
      images[c.id] = {
        front: getFaceImage(c, 0) || undefined,
        back: getFaceImage(c, 1) || undefined,
      };
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
  }, [dispatch, id, user]);

  useEffect(() => {
    void start();
  }, [start]);

  useEffect(() => {
    function close() {
      setMenu(null);
      setStepper(null);
    }
    if (menu || stepper) window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [menu, stepper]);

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
      if ((e.key === "t" || e.key === "T") && selected) {
        dispatch({ type: "tap", instanceId: selected });
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dispatch, selected, settings, table]);

  const seat = table?.seats[0];
  const tokens = useMemo(() => (id ? loadDeckTokens(id) : []), [id]);

  function onDragStart(e: DragStartEvent) {
    const card = e.active.data.current?.card as PlayCard | undefined;
    setActiveDrag(card ?? null);
    if (card) setSelected(card.instanceId);
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveDrag(null);
    const card = e.active.data.current?.card as PlayCard | undefined;
    const zone = e.over?.data.current?.zone as PlayZone | undefined;
    if (!card || !zone || !seat) return;
    dispatch({ type: "move", seatId: seat.id, instanceId: card.instanceId, to: zone });
  }

  function CardView({ card }: { card: PlayCard }) {
    return (
      <PlayFace
        card={card}
        selected={selected === card.instanceId}
        onSelect={() => setSelected(card.instanceId)}
        onTap={() => dispatch({ type: "tap", instanceId: card.instanceId })}
        onMenu={(ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          setSelected(card.instanceId);
          setMenu({ x: ev.clientX, y: ev.clientY, card });
        }}
        onCounter={(delta) =>
          dispatch({ type: "counter", instanceId: card.instanceId, key: "+1/+1", delta })
        }
      />
    );
  }

  function Pile({ zone, label }: { zone: PlayZone; label: string }) {
    if (!seat) return null;
    const cards = seat.zones[zone];
    const top = zone === "library" ? cards[0] : undefined;
    return (
      <ZoneDrop zone={zone} className={styles.pile}>
        <div className={styles.pileHead}>
          <span>{label}</span>
          <button type="button" className={styles.ghost} onClick={() => setSearchZone(zone)}>
            {cards.length}
          </button>
        </div>
        <div className={styles.pileBody}>
          {zone === "library" && top ? (
            <CardView card={{ ...top, facedown: true }} />
          ) : zone === "library" ? (
            <span className={styles.hint}>Empty</span>
          ) : (
            cards.slice(-4).map((c) => <CardView key={c.instanceId} card={c} />)
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
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveDrag(null)}
    >
      <div className={`${transitions.page} ${styles.page}`}>
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
          <div className={styles.stats}>
            {(
              [
                ["Life", "life", "life"],
                ["Poison", "poison", "stat"],
                ["Energy", "energy", "stat"],
                ["XP", "experience", "stat"],
              ] as const
            ).map(([label, key, kind]) => (
              <span key={key} className={styles.stat}>
                {label} {kind === "life" ? seat.life : seat[key]}
                <button
                  type="button"
                  onClick={() =>
                    kind === "life"
                      ? dispatch({ type: "life", seatId: seat.id, delta: -1 })
                      : dispatch({ type: "stat", seatId: seat.id, key, delta: -1 })
                  }
                >
                  −
                </button>
                <button
                  type="button"
                  onClick={() =>
                    kind === "life"
                      ? dispatch({ type: "life", seatId: seat.id, delta: 1 })
                      : dispatch({ type: "stat", seatId: seat.id, key, delta: 1 })
                  }
                >
                  +
                </button>
              </span>
            ))}
          </div>
        </div>

        <div className={styles.toolbar}>
          {settings.show.newGame && (
            <button type="button" className={styles.primary} onClick={() => void start()}>
              New game
            </button>
          )}
          {settings.show.draw && (
            <button
              type="button"
              className={styles.btn}
              onClick={() => dispatch({ type: "draw", seatId: seat.id, n: settings.drawCount })}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setStepper("draw");
              }}
            >
              Draw {settings.drawCount > 1 ? settings.drawCount : ""}
            </button>
          )}
          {settings.show.mulligan && (
            <button
              type="button"
              className={styles.btn}
              onClick={() =>
                dispatch({ type: "mulligan", seatId: seat.id, kind: settings.mulligan })
              }
            >
              Mulligan
            </button>
          )}
          {settings.show.nextTurn && (
            <button
              type="button"
              className={styles.btn}
              onClick={() =>
                dispatch({
                  type: "nextTurn",
                  untap: settings.nextTurnUntap,
                  draw: settings.nextTurnDraw,
                })
              }
            >
              Next turn
            </button>
          )}
          {settings.show.shuffle && (
            <button
              type="button"
              className={styles.btn}
              onClick={() => dispatch({ type: "shuffle", seatId: seat.id })}
            >
              Shuffle
            </button>
          )}
          {settings.show.mill && (
            <button
              type="button"
              className={styles.btn}
              onClick={() => dispatch({ type: "mill", seatId: seat.id, n: settings.millCount })}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setStepper("mill");
              }}
            >
              Mill {settings.millCount > 1 ? settings.millCount : ""}
            </button>
          )}
          {settings.show.scry && (
            <button
              type="button"
              className={styles.btn}
              onClick={() => setScryN(seat.zones.library.slice(0, settings.scryCount))}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setStepper("scry");
              }}
            >
              Scry {settings.scryCount}
            </button>
          )}
          {settings.show.undo && (
            <button
              type="button"
              className={styles.btn}
              onClick={() => {
                const prev = history.current.pop();
                if (prev) setTable(prev);
              }}
            >
              Undo
            </button>
          )}
          {settings.show.dice && (
            <>
              <button
                type="button"
                className={styles.btn}
                onClick={() => dispatch({ type: "log", text: `Rolled d20 = ${roll(20)}` })}
              >
                d20
              </button>
              <button
                type="button"
                className={styles.btn}
                onClick={() => dispatch({ type: "log", text: `Rolled d6 = ${roll(6)}` })}
              >
                d6
              </button>
            </>
          )}
          <span className={styles.hint}>Right-click Draw / Scry / Mill to change count</span>
        </div>

        {stepper && (
          <div className={styles.stepper} onClick={(e) => e.stopPropagation()}>
            {stepper}{" "}
            <button
              type="button"
              className={styles.ghost}
              onClick={() =>
                persist({
                  ...settings,
                  [`${stepper}Count`]: Math.max(1, settings[`${stepper}Count`] - 1),
                } as PlaySettings)
              }
            >
              −
            </button>
            <strong>{settings[`${stepper}Count`]}</strong>
            <button
              type="button"
              className={styles.ghost}
              onClick={() =>
                persist({
                  ...settings,
                  [`${stepper}Count`]: settings[`${stepper}Count`] + 1,
                } as PlaySettings)
              }
            >
              +
            </button>
          </div>
        )}

        <div className={styles.board}>
          <div className={styles.col}>
            <Pile zone="library" label="Library" />
            <Pile zone="graveyard" label="Graveyard" />
            <Pile zone="sideboard" label="Side" />
          </div>
          <ZoneDrop zone="battlefield" className={styles.battlefield}>
            <div className={styles.pileHead}>
              <span>Battlefield</span>
              <span>{seat.zones.battlefield.length}</span>
            </div>
            <div className={styles.bfGrid}>
              {seat.zones.battlefield.map((c) => (
                <CardView key={c.instanceId} card={c} />
              ))}
              {seat.zones.stack.length > 0 && (
                <ZoneDrop zone="stack">
                  <div className={styles.pileHead}>Stack</div>
                  {seat.zones.stack.map((c) => (
                    <CardView key={c.instanceId} card={c} />
                  ))}
                </ZoneDrop>
              )}
            </div>
          </ZoneDrop>
          <div className={styles.col}>
            <Pile zone="command" label="Command" />
            <Pile zone="exile" label="Exile" />
            <section className={styles.pile}>
              <div className={styles.pileHead}>Tokens</div>
              <div className={styles.pileBody}>
                {tokens
                  .filter((t) => t.included)
                  .slice(0, 8)
                  .map((t) => (
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
              </div>
            </section>
          </div>
        </div>

        <ZoneDrop zone="hand" className={styles.hand}>
          <div className={styles.pileHead}>
            <span>Hand</span>
            <span>{seat.zones.hand.length}</span>
          </div>
          <div className={styles.handRow}>
            {seat.zones.hand.map((c) => (
              <CardView key={c.instanceId} card={c} />
            ))}
          </div>
        </ZoneDrop>

        <div className={styles.log}>
          {[...table.log].reverse().map((l, i) => (
            <div key={`${l.at}-${i}`}>{l.text}</div>
          ))}
        </div>

        {menu && (
          <div className={styles.menu} style={{ left: menu.x, top: menu.y }} onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={() => { dispatch({ type: "tap", instanceId: menu.card.instanceId }); setMenu(null); }}>
              Tap / untap
            </button>
            <button type="button" onClick={() => { dispatch({ type: "flip", instanceId: menu.card.instanceId }); setMenu(null); }}>
              Flip face
            </button>
            <button type="button" onClick={() => { dispatch({ type: "facedown", instanceId: menu.card.instanceId }); setMenu(null); }}>
              Face down
            </button>
            {MOVE_ZONES.map((z) => (
              <button
                key={z.id}
                type="button"
                onClick={() => {
                  dispatch({ type: "move", seatId: seat.id, instanceId: menu.card.instanceId, to: z.id });
                  setMenu(null);
                }}
              >
                Move to {z.label}
              </button>
            ))}
            <button type="button" onClick={() => { setInspect(menu.card); setMenu(null); }}>
              Inspect
            </button>
          </div>
        )}

        {searchZone && (
          <div className={styles.overlay} onClick={() => setSearchZone(null)}>
            <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
              <h2>
                {searchZone} ({seat.zones[searchZone].length})
              </h2>
              <input
                className={styles.btn}
                style={{ width: "100%", borderRadius: 8, marginBottom: 8 }}
                placeholder="Filter…"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
              <div className={styles.searchList}>
                {seat.zones[searchZone]
                  .filter((c) => c.name.toLowerCase().includes(filter.toLowerCase()))
                  .map((c) => (
                    <div key={c.instanceId}>
                      <CardView card={c} />
                      <button
                        type="button"
                        className={styles.ghost}
                        onClick={() => {
                          dispatch({ type: "move", seatId: seat.id, instanceId: c.instanceId, to: "hand" });
                          if (searchZone === "library") dispatch({ type: "shuffle", seatId: seat.id });
                        }}
                      >
                        To hand
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

        {scryN && (
          <div className={styles.overlay} onClick={() => setScryN(null)}>
            <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
              <h2>Scry {scryN.length}</h2>
              <p className={styles.hint}>Click a card to put it on the bottom.</p>
              <div className={styles.searchList}>
                {scryN.map((c) => (
                  <button
                    key={c.instanceId}
                    type="button"
                    className={styles.ghost}
                    onClick={() => {
                      dispatch({
                        type: "scry",
                        seatId: seat.id,
                        keepTop: scryN.filter((x) => x.instanceId !== c.instanceId).map((x) => x.instanceId),
                        bottom: [c.instanceId],
                      });
                      setScryN((cur) => cur?.filter((x) => x.instanceId !== c.instanceId) ?? null);
                    }}
                  >
                    Bottom {c.name}
                  </button>
                ))}
              </div>
              <button type="button" className={styles.primary} onClick={() => setScryN(null)}>
                Done
              </button>
            </div>
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
              <h3 className={styles.sub}>Toolbar buttons</h3>
              {Object.entries(settings.show).map(([key, on]) => (
                <label key={key} className={styles.setting}>
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={(e) =>
                      persist({
                        ...settings,
                        show: { ...settings.show, [key]: e.target.checked },
                      })
                    }
                  />
                  {key}
                </label>
              ))}
              <button type="button" className={styles.primary} onClick={() => setSettingsOpen(false)}>
                Close
              </button>
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
