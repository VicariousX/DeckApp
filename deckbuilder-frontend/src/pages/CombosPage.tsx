import { useEffect, useMemo, useState, type MouseEvent as ReactMouseEvent } from "react";
import { useAuth } from "../auth/AuthProvider";
import { fetchAutocomplete, fetchCardsByNames, fetchNamedCard } from "../lib/scryfallApi";
import { SynergyMap } from "../components/SynergyMap";
import type { SynergyCard } from "../lib/synergy/engine";
import {
  isLinked,
  linksForNewCard,
  loadCombos,
  newColumn,
  newCombo,
  pairingCount,
  pruneLinks,
  resolvedLinks,
  saveCombos,
  toggleLink,
  type ComboCard,
  type ComboColumn,
  type ComboLock,
} from "../lib/combos";
import { ComboAtlas } from "../components/ComboAtlas";
import { loadRemoteCombos, saveRemoteCombos } from "../services/comboService";
import { CardEnlargeOverlay } from "../components/CardImage";
import { CardInspectorModal } from "../components/CardInspectorModal";
import { CardTile, CardTileField } from "../components/CardTile";
import {
  CardContextMenu,
  modalJumpFromState,
  initialTabFromJump,
  type ModalJump,
} from "../components/CardContextMenu";
import { ConfirmDialog } from "../components/ConfirmDialog";
import transitions from "../styles/pageTransitions.module.css";
import styles from "./CombosPage.module.css";

type ViewMode = "lock" | "mesh" | "map" | "atlas";

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

function Column({
  column,
  dimmed,
  onFace,
  onAdd,
  onRemoveCard,
  onRename,
  onRemoveColumn,
  onContext,
  onOpen,
  busy,
}: {
  column: ComboColumn;
  dimmed?: boolean;
  onFace: (face: number) => void;
  onAdd: (name: string) => void;
  onRemoveCard: (id: string) => void;
  onRename: (label: string) => void;
  onRemoveColumn: () => void;
  onContext: (e: ReactMouseEvent, card: ComboCard) => void;
  onOpen: (card: ComboCard) => void;
  busy: boolean;
}) {
  const cards = column.cards;
  const face = cards.length === 0 ? 0 : ((column.face % cards.length) + cards.length) % cards.length;
  const current = cards[face];

  function cycle(dir: number) {
    if (cards.length < 2) return;
    onFace((face + dir + cards.length) % cards.length);
  }

  return (
    <div className={`${styles.column} ${dimmed ? styles.columnDim : ""}`}>
      <div className={styles.columnHead}>
        <input
          className={styles.columnLabel}
          value={column.label}
          placeholder="Column"
          onChange={(e) => onRename(e.target.value)}
        />
        <button type="button" className={styles.textBtn} onClick={onRemoveColumn} aria-label="Remove column">
          ×
        </button>
      </div>

      {current ? (
        <div className={styles.columnFace}>
          <CardTile
            face={{
              name: current.name,
              imageUrl: current.image,
              scryfallId: current.scryfall_id,
              oracleId: current.oracle_id,
            }}
            ear={cards.length > 1 ? `${face + 1}/${cards.length}` : undefined}
            onOpen={() => onOpen(current)}
            onContextMenu={(e) => onContext(e as ReactMouseEvent, current)}
            right={[
              <button key="prev" type="button" className={styles.flyBtn} onClick={() => cycle(-1)} disabled={cards.length < 2} aria-label="Previous">
                ‹
              </button>,
              <button key="next" type="button" className={styles.flyBtn} onClick={() => cycle(1)} disabled={cards.length < 2} aria-label="Next">
                ›
              </button>,
            ]}
            bottom={
              <button type="button" className={`${styles.flyBtn} ${styles.flyBtnDanger}`} onClick={() => onRemoveCard(current.id)} aria-label="Remove card">
                Remove
              </button>
            }
          />
        </div>
      ) : (
        <div className={styles.columnEmpty}>No cards</div>
      )}

      {cards.length > 1 && (
        <div className={styles.columnStrip}>
          {cards.map((c, i) => (
            <button
              key={c.id}
              type="button"
              className={`${styles.stripBtn} ${i === face ? styles.stripOn : ""}`}
              onClick={() => onFace(i)}
              title={c.name}
            >
              {c.image ? <img src={c.image} alt="" /> : <span>{c.name.slice(0, 1)}</span>}
            </button>
          ))}
        </div>
      )}

      <ColumnAdd busy={busy} onAdd={onAdd} />
    </div>
  );
}

function ComboSynergyBody({
  combo,
  onSelect,
}: {
  combo: ComboLock;
  onSelect?: (oracleId: string) => void;
}) {
  const cards: SynergyCard[] = combo.columns.flatMap((col) =>
    col.cards.map((c) => ({
      key: c.oracle_id,
      name: c.name,
      oracle: c.type_line || "",
      keywords: [],
    }))
  );
  const extra = resolvedLinks(combo).map((l) => ({
    a: l.a,
    b: l.b,
  }));
  return <SynergyMap cards={cards} extraEdges={extra} onSelect={onSelect} />;
}

export function CombosPage() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [combos, setCombos] = useState<ComboLock[]>(() => loadCombos(userId));
  const [activeId, setActiveId] = useState<string | null>(() => loadCombos(userId)[0]?.id ?? null);
  const [view, setView] = useState<ViewMode>("lock");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [modalCard, setModalCard] = useState<ComboCard | null>(null);
  const [modalJump, setModalJump] = useState<ModalJump>("info");
  const [enhance, setEnhance] = useState<ComboCard | null>(null);
  const [ctx, setCtx] = useState<{ x: number; y: number; card: ComboCard } | null>(null);
  const [oracleByName, setOracleByName] = useState<Record<string, string>>({});
  const [kwByName, setKwByName] = useState<Record<string, string[]>>({});

  useEffect(() => {
    const local = loadCombos(userId);
    setCombos(local);
    setActiveId(local[0]?.id ?? null);
    if (!userId) return;
    let cancel = false;
    void loadRemoteCombos(userId).then((remote) => {
      if (cancel || !remote) return;
      if (remote.length === 0 && local.length) {
        void saveRemoteCombos(userId, local);
        return;
      }
      setCombos(remote);
      saveCombos(userId, remote);
      setActiveId((id) => (remote.some((c) => c.id === id) ? id : remote[0]?.id ?? null));
    });
    return () => {
      cancel = true;
    };
  }, [userId]);

  function persist(next: ComboLock[]) {
    setCombos(next);
    saveCombos(userId, next);
    if (userId) void saveRemoteCombos(userId, next);
  }

  function patchActive(fn: (c: ComboLock) => ComboLock) {
    if (!activeId) return;
    persist(combos.map((c) => (c.id === activeId ? { ...fn(c), updated_at: new Date().toISOString() } : c)));
  }

  const active = combos.find((c) => c.id === activeId) ?? null;
  const pairs = active ? pairingCount(active) : 0;

  async function addCard(colId: string, name: string) {
    if (!active) return;
    setBusy(true);
    setError(null);
    const { card, error: err } = await fetchNamedCard(name);
    setBusy(false);
    if (err || !card) {
      setError(err ?? "Card not found.");
      return;
    }
    const next = cardFromNamed(card);
    patchActive((c) => {
      const col = c.columns.find((x) => x.id === colId);
      if (!col) return c;
      if (col.cards.some((x) => x.oracle_id === next.oracle_id)) return c;
      return {
        ...c,
        columns: c.columns.map((x) =>
          x.id === colId ? { ...x, cards: [...x.cards, next] } : x
        ),
        links: linksForNewCard(c, next.oracle_id, colId),
      };
    });
  }

  const comboNames = useMemo(
    () => (active ? [...new Set(active.columns.flatMap((c) => c.cards.map((x) => x.name)))] : []),
    [active]
  );

  useEffect(() => {
    if (view !== "map" || !comboNames.length) return;
    let cancel = false;
    void fetchCardsByNames(comboNames).then(({ byName }) => {
      if (cancel) return;
      const o: Record<string, string> = {};
      const k: Record<string, string[]> = {};
      for (const [name, c] of byName) {
        o[name] = c.oracle_id || c.id;
        k[name] = c.keywords ?? [];
      }
      setOracleByName(o);
      setKwByName(k);
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
            Columns of cards. Cards in different columns are linked until you unlink them.
          </p>
        </div>
        <div className={styles.viewToggle} role="group" aria-label="View">
          {(["lock", "mesh", "map", "atlas"] as const).map((v) => (
            <button
              key={v}
              type="button"
              className={view === v ? styles.viewBtnActive : styles.viewBtn}
              onClick={() => setView(v)}
            >
              {v === "atlas" ? "Atlas" : v[0].toUpperCase() + v.slice(1)}
            </button>
          ))}
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
                  className={c.id === activeId ? styles.comboItemActive : styles.comboItem}
                  onClick={() => setActiveId(c.id)}
                >
                  <span>{c.name}</span>
                  <small>{c.columns.reduce((n, col) => n + col.cards.length, 0)} cards</small>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <section className={styles.stage}>
          {!active && <p className={styles.muted}>No combo selected. Create one, then add cards.</p>}
          {active && (
            <>
              <div className={styles.comboHead}>
                <input
                  className={styles.comboName}
                  value={active.name}
                  onChange={(e) => patchActive((c) => ({ ...c, name: e.target.value }))}
                />
                <span className={styles.pairings}>
                  {pairs} pairing{pairs === 1 ? "" : "s"}
                </span>
                <button type="button" className={styles.textBtn} onClick={() => setDeleteId(active.id)}>
                  Delete
                </button>
              </div>

              {view === "lock" && (
                <CardTileField>
                  <div className={styles.lock}>
                    {active.columns.map((col) => {
                      const faceCard = col.cards[col.cards.length ? ((col.face % col.cards.length) + col.cards.length) % col.cards.length : 0];
                      const dimmed = Boolean(
                        faceCard &&
                          active.columns.some((other) => {
                            if (other.id === col.id) return false;
                            const o = other.cards[other.cards.length ? ((other.face % other.cards.length) + other.cards.length) % other.cards.length : 0];
                            return o && !isLinked(active, faceCard.oracle_id, o.oracle_id);
                          })
                      );
                      return (
                        <Column
                          key={col.id}
                          column={col}
                          dimmed={dimmed}
                          busy={busy}
                          onFace={(face) =>
                            patchActive((c) => ({
                              ...c,
                              columns: c.columns.map((x) => (x.id === col.id ? { ...x, face } : x)),
                            }))
                          }
                          onAdd={(name) => void addCard(col.id, name)}
                          onRemoveCard={(id) =>
                            patchActive((c) =>
                              pruneLinks({
                                ...c,
                                columns: c.columns.map((x) =>
                                  x.id === col.id
                                    ? { ...x, cards: x.cards.filter((card) => card.id !== id), face: 0 }
                                    : x
                                ),
                              })
                            )
                          }
                          onRename={(label) =>
                            patchActive((c) => ({
                              ...c,
                              columns: c.columns.map((x) => (x.id === col.id ? { ...x, label } : x)),
                            }))
                          }
                          onRemoveColumn={() =>
                            patchActive((c) =>
                              pruneLinks({
                                ...c,
                                columns: c.columns.filter((x) => x.id !== col.id),
                              })
                            )
                          }
                          onContext={(e, card) => {
                            e.preventDefault();
                            setCtx({ x: e.clientX, y: e.clientY, card });
                          }}
                          onOpen={setModalCard}
                        />
                      );
                    })}
                    <button
                      type="button"
                      className={styles.addColumn}
                      onClick={() =>
                        patchActive((c) => ({
                          ...c,
                          columns: [...c.columns, newColumn()],
                        }))
                      }
                    >
                      + Column
                    </button>
                  </div>
                </CardTileField>
              )}

              {view === "mesh" && (
                <div className={styles.mesh}>
                  {active.columns.map((col) => (
                    <div key={col.id} className={styles.meshCol}>
                      <h3>{col.label || "Column"}</h3>
                      <div className={styles.meshCards}>
                        {col.cards.map((c) => (
                          <button key={c.id} type="button" className={styles.meshCard} onClick={() => setModalCard(c)}>
                            {c.image ? <img src={c.image} alt={c.name} /> : <span>{c.name}</span>}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {view === "map" && <ComboSynergyBody combo={active} onSelect={(id) => {
                const card = active.columns.flatMap((c) => c.cards).find((x) => x.oracle_id === id);
                if (card) setModalCard(card);
              }} />}

              {view === "atlas" && <ComboAtlas combos={combos} onSelect={setModalCard} />}
            </>
          )}
          {error && <p className={styles.error}>{error}</p>}
        </section>
      </div>

      {ctx && (
        <CardContextMenu
          x={ctx.x}
          y={ctx.y}
          target={{
            name: ctx.card.name,
            scryfallId: ctx.card.scryfall_id,
            oracleId: ctx.card.oracle_id,
            imageUrl: ctx.card.image,
            typeLine: ctx.card.type_line,
          }}
          onClose={() => setCtx(null)}
          onEnhance={() => {
            setEnhance(ctx.card);
            setCtx(null);
          }}
          onOpenModal={(jump: ModalJump) => {
            setModalJump(jump);
            setModalCard(ctx.card);
            setCtx(null);
          }}
          linkChoices={
            active
              ? active.columns
                  .filter((col) => !col.cards.some((c) => c.oracle_id === ctx.card.oracle_id))
                  .flatMap((col) =>
                    col.cards.map((c) => ({
                      id: c.oracle_id,
                      name: `${c.name}${col.label ? ` · ${col.label}` : ""}`,
                      on: isLinked(active, ctx.card.oracle_id, c.oracle_id),
                      onToggle: () =>
                        patchActive((combo) => toggleLink(combo, ctx.card.oracle_id, c.oracle_id)),
                    }))
                  )
              : []
          }
        />
      )}

      {modalCard && (
        <CardInspectorModal
          scryfallId={modalCard.scryfall_id}
          name={modalCard.name}
          imageUrl={modalCard.image}
          initialTab={initialTabFromJump(modalJump)}
          onClose={() => setModalCard(null)}
        />
      )}

      {enhance && (
        <CardEnlargeOverlay
          frontSrc={enhance.image || ""}
          frontName={enhance.name}
          onClose={() => setEnhance(null)}
        />
      )}

      {deleteId && (
        <ConfirmDialog
          title="Delete combo?"
          message="This cannot be undone."
          onConfirm={() => {
            persist(combos.filter((c) => c.id !== deleteId));
            if (activeId === deleteId) setActiveId(combos.find((c) => c.id !== deleteId)?.id ?? null);
            setDeleteId(null);
          }}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  );
}
