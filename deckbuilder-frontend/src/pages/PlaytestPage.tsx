import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
} from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { fetchDeckDetail } from "../services/deckService";
import { fetchCollectionByIds } from "../lib/scryfallApi";
import { getFaceImage } from "../utils/scryfall";
import { loadDeckTokens } from "../lib/deck/deckTokens";
import {
  cardImage,
  createTableFromDeck,
  reducePlay,
} from "../lib/playtest/engine";
import type { PlayAction, PlayCard, PlayZone, TableState } from "../lib/playtest/types";
import { CardInspectorModal } from "../components/CardInspectorModal";
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
    }
    if (menu) window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [menu]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!table) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const seat = table.seats[0];
      if (e.key === "d" || e.key === "D") dispatch({ type: "draw", seatId: seat.id });
      if (e.key === "n" || e.key === "N") dispatch({ type: "nextTurn" });
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
  }, [dispatch, selected, table]);

  const seat = table?.seats[0];
  const tokens = useMemo(() => (id ? loadDeckTokens(id) : []), [id]);

  function onDragStart(e: DragEvent, card: PlayCard) {
    e.dataTransfer.setData("text/plain", card.instanceId);
    e.dataTransfer.effectAllowed = "move";
    setSelected(card.instanceId);
  }

  function onDropZone(e: DragEvent, zone: PlayZone) {
    e.preventDefault();
    const instanceId = e.dataTransfer.getData("text/plain");
    if (!instanceId || !seat) return;
    dispatch({ type: "move", seatId: seat.id, instanceId, to: zone });
  }

  function allow(e: DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }

  function CardView({ card, large }: { card: PlayCard; large?: boolean }) {
    const src = cardImage(card);
    return (
      <button
        type="button"
        className={`${styles.card}${card.tapped ? ` ${styles.tapped}` : ""}${
          selected === card.instanceId ? ` ${styles.selected}` : ""
        }`}
        style={large ? { width: "6.4rem" } : undefined}
        draggable
        onDragStart={(e) => onDragStart(e, card)}
        onClick={(e) => {
          e.stopPropagation();
          setSelected(card.instanceId);
        }}
        onDoubleClick={() => dispatch({ type: "tap", instanceId: card.instanceId })}
        onContextMenu={(e) => {
          e.preventDefault();
          setSelected(card.instanceId);
          setMenu({ x: e.clientX, y: e.clientY, card });
        }}
      >
        {src ? (
          <img src={src} alt={card.name} />
        ) : (
          <span className={styles.cardFace}>{card.facedown ? "Facedown" : card.name}</span>
        )}
        {Object.keys(card.counters).length > 0 && (
          <span className={styles.badge}>
            {Object.entries(card.counters)
              .map(([k, v]) => `${v}${k === "+1/+1" ? "" : k[0]}`)
              .join(" ")}
          </span>
        )}
      </button>
    );
  }

  function Pile({ zone, label }: { zone: PlayZone; label: string }) {
    if (!seat) return null;
    const cards = seat.zones[zone];
    const top = zone === "library" ? cards[0] : undefined;
    return (
      <section
        className={styles.pile}
        onDragOver={allow}
        onDrop={(e) => onDropZone(e, zone)}
      >
        <div className={styles.pileHead}>
          <span>{label}</span>
          <button
            type="button"
            className={styles.ghost}
            onClick={() => setSearchZone(zone)}
          >
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
      </section>
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
    <div className={`${transitions.page} ${styles.page}`}>
      <div className={styles.top}>
        <Link to={`/deck/${id}`} className={styles.back}>
          ← {table.deckName}
        </Link>
        <h1 className={styles.title}>Playtest</h1>
        <span className={styles.muted}>
          Turn {table.turn} · {table.format}
        </span>
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
        <button type="button" className={styles.primary} onClick={() => void start()}>
          New game
        </button>
        <button type="button" className={styles.btn} onClick={() => dispatch({ type: "draw", seatId: seat.id })}>
          Draw
        </button>
        <button type="button" className={styles.btn} onClick={() => dispatch({ type: "mulligan", seatId: seat.id })}>
          Mulligan
        </button>
        <button type="button" className={styles.btn} onClick={() => dispatch({ type: "nextTurn" })}>
          Next turn
        </button>
        <button type="button" className={styles.btn} onClick={() => dispatch({ type: "shuffle", seatId: seat.id })}>
          Shuffle
        </button>
        <button
          type="button"
          className={styles.btn}
          onClick={() => dispatch({ type: "mill", seatId: seat.id, n: 1 })}
        >
          Mill
        </button>
        <button
          type="button"
          className={styles.btn}
          onClick={() => setScryN(seat.zones.library.slice(0, 2))}
        >
          Scry 2
        </button>
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
        <span className={styles.hint}>D draw · N next · T tap · U undo</span>
      </div>

      <div className={styles.board}>
        <div className={styles.col}>
          <Pile zone="library" label="Library" />
          <Pile zone="graveyard" label="Graveyard" />
          <Pile zone="sideboard" label="Side" />
        </div>
        <section
          className={styles.battlefield}
          onDragOver={allow}
          onDrop={(e) => onDropZone(e, "battlefield")}
          onClick={() => setSelected(null)}
        >
          <div className={styles.pileHead}>
            <span>Battlefield</span>
            <span>{seat.zones.battlefield.length}</span>
          </div>
          <div className={styles.bfGrid}>
            {seat.zones.battlefield.map((c) => (
              <CardView key={c.instanceId} card={c} large />
            ))}
            {seat.zones.stack.length > 0 && (
              <div>
                <div className={styles.pileHead}>Stack</div>
                {seat.zones.stack.map((c) => (
                  <CardView key={c.instanceId} card={c} />
                ))}
              </div>
            )}
          </div>
        </section>
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

      <section
        className={styles.hand}
        onDragOver={allow}
        onDrop={(e) => onDropZone(e, "hand")}
      >
        <div className={styles.pileHead}>
          <span>Hand</span>
          <span>{seat.zones.hand.length}</span>
        </div>
        <div className={styles.handRow}>
          {seat.zones.hand.map((c) => (
            <CardView key={c.instanceId} card={c} large />
          ))}
        </div>
      </section>

      <div className={styles.log}>
        {[...table.log].reverse().map((l, i) => (
          <div key={`${l.at}-${i}`}>{l.text}</div>
        ))}
      </div>

      {menu && (
        <div className={styles.menu} style={{ left: menu.x, top: menu.y }}>
          <button type="button" onClick={() => { dispatch({ type: "tap", instanceId: menu.card.instanceId }); setMenu(null); }}>
            Tap / untap
          </button>
          <button type="button" onClick={() => { dispatch({ type: "flip", instanceId: menu.card.instanceId }); setMenu(null); }}>
            Flip face
          </button>
          <button type="button" onClick={() => { dispatch({ type: "facedown", instanceId: menu.card.instanceId }); setMenu(null); }}>
            Face down
          </button>
          <button
            type="button"
            onClick={() => {
              dispatch({ type: "counter", instanceId: menu.card.instanceId, key: "+1/+1", delta: 1 });
              setMenu(null);
            }}
          >
            +1/+1
          </button>
          <button
            type="button"
            onClick={() => {
              dispatch({ type: "counter", instanceId: menu.card.instanceId, key: "+1/+1", delta: -1 });
              setMenu(null);
            }}
          >
            −1/−1 counter
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
            <h2>Scry</h2>
            <p className={styles.hint}>Click a card to send it to the bottom, leave the rest on top.</p>
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
                    setScryN(null);
                  }}
                >
                  Bottom {c.name}
                </button>
              ))}
            </div>
            <button type="button" className={styles.primary} onClick={() => setScryN(null)}>
              Leave on top
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
  );
}
