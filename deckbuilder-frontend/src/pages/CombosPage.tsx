import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { useAuth } from "../auth/AuthProvider";
import { fetchAutocomplete, fetchCardsByNames, fetchNamedCard } from "../lib/scryfallApi";
import { SynergyMap } from "../components/SynergyMap";
import type { SynergyCard } from "../lib/synergy/engine";
import {
  loadCombos,
  newColumn,
  newCombo,
  pairingCount,
  saveCombos,
  type ComboCard,
  type ComboColumn,
  type ComboLock,
} from "../lib/combos";
import { CardEnlargeOverlay } from "../components/CardImage";
import { CardInspectorModal } from "../components/CardInspectorModal";
import {
  CardContextMenu,
  type ModalJump,
} from "../components/CardContextMenu";
import { ConfirmDialog } from "../components/ConfirmDialog";
import transitions from "../styles/pageTransitions.module.css";
import styles from "./CombosPage.module.css";

type ViewMode = "lock" | "mesh" | "map";

function cardFromNamed(card: {
  id: string;
  oracle_id?: string;
  name: string;
  type_line?: string;
  image_uris?: { normal?: string; small?: string } | null;
  card_faces?: { image_uris?: { normal?: string; small?: string } | null }[] | null;
}): ComboCard {
  return {
    id: card.id,
    oracle_id: card.oracle_id || card.id,
    scryfall_id: card.id,
    name: card.name,
    type_line: card.type_line || "",
    image:
      card.image_uris?.normal ||
      card.image_uris?.small ||
      card.card_faces?.[0]?.image_uris?.normal ||
      card.card_faces?.[0]?.image_uris?.small,
  };
}

function ColumnAdd({
  busy,
  onAdd,
}: {
  busy: boolean;
  onAdd: (name: string) => void;
}) {
  const [q, setQ] = useState("");
  const [names, setNames] = useState<string[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const t = q.trim();
    if (t.length < 2) {
      setNames([]);
      return;
    }
    let cancel = false;
    const id = window.setTimeout(() => {
      void fetchAutocomplete(t).then(({ names: n }) => {
        if (!cancel) {
          setNames(n);
          setOpen(n.length > 0);
        }
      });
    }, 140);
    return () => {
      cancel = true;
      window.clearTimeout(id);
    };
  }, [q]);

  return (
    <div className={styles.addWrap}>
      <input
        className={styles.addInput}
        value={q}
        placeholder="Add card…"
        autoComplete="off"
        disabled={busy}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => names.length && setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 160)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && q.trim()) {
            e.preventDefault();
            onAdd(q.trim());
            setQ("");
            setOpen(false);
          }
        }}
      />
      {open && names.length > 0 && (
        <ul className={styles.suggest}>
          {names.map((n) => (
            <li key={n}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onAdd(n);
                  setQ("");
                  setOpen(false);
                }}
              >
                {n}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Wheel({
  column,
  onFace,
  onAdd,
  onRemoveCard,
  onRename,
  onRemoveColumn,
  onContext,
  onEnhance,
  busy,
}: {
  column: ComboColumn;
  onFace: (face: number) => void;
  onAdd: (name: string) => void;
  onRemoveCard: (id: string) => void;
  onRename: (label: string) => void;
  onRemoveColumn: () => void;
  onContext: (e: ReactMouseEvent, card: ComboCard) => void;
  onEnhance: (card: ComboCard) => void;
  busy: boolean;
}) {
  const acc = useRef(0);
  const cards = column.cards;
  const face =
    cards.length === 0 ? 0 : ((column.face % cards.length) + cards.length) % cards.length;
  const current = cards[face];
  const prev = cards.length > 1 ? cards[(face - 1 + cards.length) % cards.length] : null;
  const next = cards.length > 1 ? cards[(face + 1) % cards.length] : null;

  function cycle(dir: number) {
    if (cards.length < 2) return;
    onFace((face + dir + cards.length) % cards.length);
  }

  return (
    <div className={styles.wheel}>
      <div className={styles.wheelCap}>
        <input
          className={styles.colLabel}
          value={column.label}
          aria-label="Column name"
          onChange={(e) => onRename(e.target.value)}
        />
        <button
          type="button"
          className={styles.iconBtn}
          aria-label="Remove column"
          onClick={onRemoveColumn}
        >
          ×
        </button>
      </div>
      <div
        className={styles.tumbler}
        onWheel={(e) => {
          if (cards.length < 2) return;
          e.preventDefault();
          acc.current += e.deltaY;
          if (Math.abs(acc.current) > 36) {
            cycle(acc.current > 0 ? 1 : -1);
            acc.current = 0;
          }
        }}
      >
        <button
          type="button"
          className={`${styles.peek} ${styles.peekTop}`}
          disabled={!prev}
          onClick={() => cycle(-1)}
          aria-label="Previous card"
        >
          {prev?.image ? <img src={prev.image} alt="" /> : <span />}
        </button>
        <div className={styles.window}>
          {current ? (
            <button
              type="button"
              className={styles.faceBtn}
              onClick={() => onEnhance(current)}
              onContextMenu={(e) => onContext(e, current)}
            >
              {current.image ? (
                <img src={current.image} alt={current.name} />
              ) : (
                <span className={styles.faceName}>{current.name}</span>
              )}
            </button>
          ) : (
            <div className={styles.emptyFace} aria-hidden>
              +
            </div>
          )}
        </div>
        <button
          type="button"
          className={`${styles.peek} ${styles.peekBot}`}
          disabled={!next}
          onClick={() => cycle(1)}
          aria-label="Next card"
        >
          {next?.image ? <img src={next.image} alt="" /> : <span />}
        </button>
      </div>
      <p className={styles.faceCaption}>
        {current
          ? `${current.name}${cards.length > 1 ? ` · ${face + 1}/${cards.length}` : ""}`
          : "Empty slot"}
      </p>
      <ColumnAdd busy={busy} onAdd={onAdd} />
      {current && (
        <button
          type="button"
          className={styles.textBtn}
          onClick={() => onRemoveCard(current.id)}
        >
          Remove face
        </button>
      )}
    </div>
  );
}

function ComboSynergyBody({
  combo,
  oracleByName,
  kwByName,
  onSelect,
}: {
  combo: ComboLock;
  oracleByName: Record<string, string>;
  kwByName: Record<string, string[]>;
  onSelect: (key: string) => void;
}) {
  const cards: SynergyCard[] = combo.columns.flatMap((col) =>
    col.cards.map((c) => ({
      key: c.oracle_id || c.id,
      name: c.name,
      oracle: oracleByName[c.name.toLowerCase()] ?? "",
      keywords: kwByName[c.name.toLowerCase()],
    }))
  );
  const extra = [];
  for (let i = 0; i < combo.columns.length - 1; i++) {
    for (const a of combo.columns[i].cards) {
      for (const b of combo.columns[i + 1].cards) {
        extra.push({
          a: a.oracle_id || a.id,
          b: b.oracle_id || b.id,
          label: "lock",
        });
      }
    }
  }
  return <SynergyMap cards={cards} extraEdges={extra} onSelect={onSelect} />;
}

export function CombosPage() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [combos, setCombos] = useState<ComboLock[]>(() => loadCombos(userId));
  const [activeId, setActiveId] = useState<string | null>(
    () => loadCombos(userId)[0]?.id ?? null
  );
  const [view, setView] = useState<ViewMode>("lock");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [modalCard, setModalCard] = useState<ComboCard | null>(null);
  const [modalJump, setModalJump] = useState<ModalJump>("info");
  const [enhance, setEnhance] = useState<ComboCard | null>(null);
  const [ctx, setCtx] = useState<{
    x: number;
    y: number;
    card: ComboCard;
  } | null>(null);
  const [oracleByName, setOracleByName] = useState<Record<string, string>>({});
  const [kwByName, setKwByName] = useState<Record<string, string[]>>({});

  useEffect(() => {
    const loaded = loadCombos(userId);
    setCombos(loaded);
    setActiveId(loaded[0]?.id ?? null);
  }, [userId]);

  function persist(next: ComboLock[]) {
    setCombos(next);
    saveCombos(userId, next);
  }

  const active = combos.find((c) => c.id === activeId) ?? null;

  function patchActive(mut: (c: ComboLock) => ComboLock) {
    if (!active) return;
    const next = combos.map((c) =>
      c.id === active.id
        ? { ...mut(c), updated_at: new Date().toISOString() }
        : c
    );
    persist(next);
  }

  async function addCard(colId: string, name: string) {
    setBusy(true);
    setError(null);
    const { card, error: err } = await fetchNamedCard(name, "fuzzy");
    setBusy(false);
    if (!card) {
      setError(err ?? "Card not found");
      return;
    }
    const piece = cardFromNamed(card);
    patchActive((combo) => ({
      ...combo,
      columns: combo.columns.map((col) => {
        if (col.id !== colId) return col;
        if (col.cards.some((c) => c.oracle_id === piece.oracle_id)) return col;
        const cards = [...col.cards, piece];
        return { ...col, cards, face: cards.length - 1 };
      }),
    }));
  }

  const pairs = active ? pairingCount(active) : 0;

  const comboNames = useMemo(
    () =>
      active
        ? [...new Set(active.columns.flatMap((c) => c.cards.map((x) => x.name)))]
        : [],
    [active]
  );

  useEffect(() => {
    if (view !== "map" || !comboNames.length) return;
    let cancel = false;
    void fetchCardsByNames(comboNames).then(({ byName }) => {
      if (cancel) return;
      const text: Record<string, string> = {};
      const kw: Record<string, string[]> = {};
      for (const [k, card] of byName) {
        text[k] = [
          card.oracle_text ?? "",
          ...(card.card_faces ?? []).map((f) => f.oracle_text ?? ""),
        ].join(" ");
        kw[k] = card.keywords ?? [];
      }
      setOracleByName(text);
      setKwByName(kw);
    });
    return () => {
      cancel = true;
    };
  }, [view, comboNames]);

  return (
    <div className={`${styles.page} ${transitions.page}`}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Combos</h1>
          <p className={styles.subtitle}>
            Each wheel is a slot in the lock. Any card in a column works with
            any card in the other columns.
          </p>
        </div>
        <div className={styles.viewToggle} role="group" aria-label="View">
          <button
            type="button"
            className={view === "lock" ? styles.viewBtnActive : styles.viewBtn}
            onClick={() => setView("lock")}
          >
            Lock
          </button>
          <button
            type="button"
            className={view === "mesh" ? styles.viewBtnActive : styles.viewBtn}
            onClick={() => setView("mesh")}
          >
            Mesh
          </button>
          <button
            type="button"
            className={view === "map" ? styles.viewBtnActive : styles.viewBtn}
            onClick={() => setView("map")}
          >
            Map
          </button>
        </div>
      </header>

      <div className={styles.layout}>
        <aside className={styles.sidebar}>
          <button
            type="button"
            className={styles.primaryBtn}
            onClick={() => {
              const combo = newCombo(`Combo ${combos.length + 1}`);
              persist([combo, ...combos]);
              setActiveId(combo.id);
            }}
          >
            New combo
          </button>
          <ul className={styles.comboList}>
            {combos.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  className={
                    c.id === activeId ? styles.comboItemActive : styles.comboItem
                  }
                  onClick={() => setActiveId(c.id)}
                >
                  <span>{c.name}</span>
                  <small>
                    {c.columns.reduce((n, col) => n + col.cards.length, 0)} cards
                  </small>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <section className={styles.stage}>
          {!active && (
            <p className={styles.muted}>
              Start a combo to line up cards on the lock.
            </p>
          )}
          {active && (
            <>
              <div className={styles.comboHead}>
                <input
                  className={styles.comboName}
                  value={active.name}
                  onChange={(e) =>
                    patchActive((c) => ({ ...c, name: e.target.value }))
                  }
                />
                <span className={styles.pairings}>
                  {pairs} pairing{pairs === 1 ? "" : "s"}
                </span>
                <button
                  type="button"
                  className={styles.textBtn}
                  onClick={() => setDeleteId(active.id)}
                >
                  Delete combo
                </button>
              </div>

              {view === "lock" && (
                <div className={styles.lock}>
                  <div className={styles.shackle} aria-hidden />
                  <div className={styles.lockBody}>
                    {active.columns.map((col) => (
                      <Wheel
                        key={col.id}
                        column={col}
                        busy={busy}
                        onFace={(face) =>
                          patchActive((c) => ({
                            ...c,
                            columns: c.columns.map((x) =>
                              x.id === col.id ? { ...x, face } : x
                            ),
                          }))
                        }
                        onAdd={(name) => void addCard(col.id, name)}
                        onRemoveCard={(id) =>
                          patchActive((c) => ({
                            ...c,
                            columns: c.columns.map((x) =>
                              x.id === col.id
                                ? {
                                    ...x,
                                    cards: x.cards.filter((card) => card.id !== id),
                                    face: 0,
                                  }
                                : x
                            ),
                          }))
                        }
                        onRename={(label) =>
                          patchActive((c) => ({
                            ...c,
                            columns: c.columns.map((x) =>
                              x.id === col.id ? { ...x, label } : x
                            ),
                          }))
                        }
                        onRemoveColumn={() =>
                          patchActive((c) => ({
                            ...c,
                            columns: c.columns.filter((x) => x.id !== col.id),
                          }))
                        }
                        onContext={(e, card) => {
                          e.preventDefault();
                          setCtx({ x: e.clientX, y: e.clientY, card });
                        }}
                        onEnhance={setEnhance}
                      />
                    ))}
                    <button
                      type="button"
                      className={styles.addColumn}
                      onClick={() =>
                        patchActive((c) => ({
                          ...c,
                          columns: [
                            ...c.columns,
                            newColumn(`Piece ${c.columns.length + 1}`),
                          ],
                        }))
                      }
                      aria-label="Add column"
                    >
                      <span className={styles.addColumnGhost}>+</span>
                      <span className={styles.addColumnPlus}>+</span>
                    </button>
                  </div>
                </div>
              )}
              {view === "mesh" && (
                <div className={styles.mesh}>
                  {active.columns.map((col, i) => (
                    <div key={col.id} className={styles.meshCol}>
                      <h3>{col.label || `Column ${i + 1}`}</h3>
                      <ul>
                        {col.cards.map((card) => (
                          <li key={card.id}>
                            <button
                              type="button"
                              className={styles.meshCard}
                              onClick={() => setEnhance(card)}
                              onContextMenu={(e) => {
                                e.preventDefault();
                                setCtx({ x: e.clientX, y: e.clientY, card });
                              }}
                            >
                              {card.image && <img src={card.image} alt="" />}
                              <span>{card.name}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                      {i < active.columns.length - 1 && (
                        <div className={styles.meshLink} aria-hidden>
                          ↔
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {view === "map" && (
                <div className={styles.mapPane}>
                  <p className={styles.muted}>
                    Solid lines are shared mechanics. Dashed lines are lock
                    pairings (any card in one wheel with any card in the next).
                  </p>
                  <ComboSynergyBody
                    combo={active}
                    oracleByName={oracleByName}
                    kwByName={kwByName}
                    onSelect={(key) => {
                      const card = active.columns
                        .flatMap((c) => c.cards)
                        .find((c) => c.oracle_id === key || c.id === key);
                      if (card) setEnhance(card);
                    }}
                  />
                </div>
              )}
              {error && <p className={styles.error}>{error}</p>}
            </>
          )}
        </section>
      </div>

      {ctx && (
        <CardContextMenu
          x={ctx.x}
          y={ctx.y}
          target={{
            scryfallId: ctx.card.scryfall_id,
            oracleId: ctx.card.oracle_id,
            name: ctx.card.name,
            typeLine: ctx.card.type_line,
            imageUrl: ctx.card.image,
          }}
          onClose={() => setCtx(null)}
          onEnhance={() => setEnhance(ctx.card)}
          onOpenModal={(jump) => {
            setModalJump(jump);
            setModalCard(ctx.card);
          }}
        />
      )}
      {enhance && (
        <CardEnlargeOverlay
          frontSrc={enhance.image || ""}
          frontName={enhance.name}
          onClose={() => setEnhance(null)}
          onActivate={() => {
            setModalCard(enhance);
            setEnhance(null);
          }}
        />
      )}
      {modalCard && (
        <CardInspectorModal
          key={`${modalCard.id}-${modalJump}`}
          initialTab={
            modalJump.startsWith("artwork")
              ? "artwork"
              : modalJump.startsWith("info")
                ? "info"
                : modalJump === "deck" || modalJump === "drawers" || modalJump === "mechanics"
                  ? modalJump
                  : "info"
          }
          initialInfoSub={modalJump === "info:rulings" ? "rulings" : "details"}
          initialArtSub={modalJump === "artwork:upload" ? "upload" : "prints"}
          scryfallId={modalCard.scryfall_id}
          name={modalCard.name}
          imageUrl={modalCard.image}
          onClose={() => setModalCard(null)}
        />
      )}
      {deleteId && (
        <ConfirmDialog
          title="Delete this combo?"
          message="The lock and its columns will be removed from this device."
          confirmLabel="Delete"
          cancelLabel="Cancel"
          onCancel={() => setDeleteId(null)}
          onConfirm={() => {
            const next = combos.filter((c) => c.id !== deleteId);
            persist(next);
            setActiveId(next[0]?.id ?? null);
            setDeleteId(null);
          }}
        />
      )}
    </div>
  );
}
