import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
} from "react";
import { useNavigate } from "react-router-dom";
import { CATEGORIES, FIELD_TO_CATEGORY } from "../../lib/search/categories";
import { fieldAllowsSymbols, suggestionsFor } from "../../lib/search/autocomplete";
import {
  emptyGroup,
  parseQuery,
  serializeClause,
  serializeQuery,
  type Clause,
  type CmpOp,
  type Group,
  type Node,
  uid,
} from "../../lib/search/syntaxModel";
import { renderManaSymbol } from "../../utils/symbols";
import styles from "./AdvancedSearch.module.css";

const SYMBOLS = [
  { insert: "~", label: "~ name" },
  { insert: "{W}", label: "{W}" },
  { insert: "{U}", label: "{U}" },
  { insert: "{B}", label: "{B}" },
  { insert: "{R}", label: "{R}" },
  { insert: "{G}", label: "{G}" },
  { insert: "{C}", label: "{C}" },
  { insert: "{S}", label: "{S}" },
  { insert: "{X}", label: "{X}" },
  { insert: "{T}", label: "{T}" },
  { insert: "{Q}", label: "{Q}" },
  { insert: "{E}", label: "{E}" },
  { insert: "{P}", label: "{P}" },
];

const ALL_OPS: CmpOp[] = [":", "=", ">", "<", ">=", "<="];
const TEXT_OPS: CmpOp[] = [":"];
const NUM_OPS: CmpOp[] = [":", "=", ">", "<", ">=", "<="];

const SHORTCUTS: Record<string, string> = {
  n: "name",
  t: "t",
  o: "o",
  c: "c",
  i: "id",
  m: "m",
  v: "mv",
  p: "pow",
  r: "r",
  f: "f",
  a: "a",
  s: "s",
  k: "kw",
};

const PINNED = ["name", "t", "c", "id", "o", "m", "mv", "r"];
const COLORS = [
  { id: "w", sym: "{W}" },
  { id: "u", sym: "{U}" },
  { id: "b", sym: "{B}" },
  { id: "r", sym: "{R}" },
  { id: "g", sym: "{G}" },
  { id: "c", sym: "{C}" },
];

function opsFor(opt?: FieldOpt | null): CmpOp[] {
  if (!opt) return TEXT_OPS;
  if (opt.ops && opt.ops.length) return opt.ops.filter((o) => o !== "!=");
  if (opt.category === "stats" || opt.category === "prices" || opt.category === "dates" || opt.key === "mv") {
    return NUM_OPS;
  }
  if (opt.category === "colors" || opt.key === "produces") return NUM_OPS;
  return TEXT_OPS;
}

function isColorField(opt?: FieldOpt | null) {
  return Boolean(opt && (opt.category === "colors" || opt.key === "produces"));
}

type FieldOpt = { category: string; key: string; label: string; group: string; hint?: string; ops?: CmpOp[] };

const FIELD_OPTS: FieldOpt[] = CATEGORIES.filter((c) => c.id !== "custom").flatMap((c) =>
  c.fields.map((f) => ({
    category: c.id,
    key: f.key,
    label: f.key ? `${f.key} · ${f.label}` : f.label,
    group: c.label,
    hint: f.hint,
    ops: f.ops,
  }))
);

type Draft = {
  category: string;
  field: string;
  op: CmpOp;
  excluded: boolean;
  value: string;
  editId?: string;
};

const EMPTY: Draft = { category: "", field: "", op: ":", excluded: false, value: "" };

function findNode(root: Group, id: string): { parent: Group; index: number } | null {
  const i = root.items.findIndex((n) => n.id === id);
  if (i >= 0) return { parent: root, index: i };
  for (const n of root.items) {
    if (n.kind === "group") {
      const hit = findNode(n, id);
      if (hit) return hit;
    }
  }
  return null;
}

function removeNode(root: Group, id: string): Group {
  return {
    ...root,
    items: root.items
      .filter((n) => n.id !== id)
      .map((n) => (n.kind === "group" ? removeNode(n, id) : n)),
  };
}

function containsId(node: Node, id: string): boolean {
  if (node.id === id) return true;
  return node.kind === "group" && node.items.some((n) => containsId(n, id));
}

function insertInto(root: Group, groupId: string, node: Node): Group {
  if (node.id === groupId) return root;
  if (node.kind === "group" && containsId(node, groupId)) return root;
  if (root.id === groupId) {
    if (root.items.some((n) => n.id === node.id)) return root;
    return { ...root, items: [...root.items, node] };
  }
  return {
    ...root,
    items: root.items.map((n) => (n.kind === "group" ? insertInto(n, groupId, node) : n)),
  };
}

function replaceNode(root: Group, id: string, next: Node): Group {
  return {
    ...root,
    items: root.items.map((n) => {
      if (n.id === id) return next;
      if (n.kind === "group") return replaceNode(n, id, next);
      return n;
    }),
  };
}

export function AdvancedSearch({ initialQuery = "" }: { initialQuery?: string }) {
  const navigate = useNavigate();
  const [root, setRoot] = useState<Group>(() => parseQuery(initialQuery, FIELD_TO_CATEGORY));
  const [bar, setBar] = useState(initialQuery);
  const [barDirty, setBarDirty] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const fieldBox = useRef<HTMLInputElement>(null);
  const valueBox = useRef<HTMLInputElement>(null);

  const serialized = useMemo(() => serializeQuery(root), [root]);
  const hasTokens = serialized.trim().length > 0;

  useEffect(() => {
    if (barDirty) return;
    setBar((prev) => (prev === serialized ? prev : serialized));
  }, [serialized, barDirty]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName;
      const typing = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
      if (e.key === "/" && !typing) {
        e.preventDefault();
        fieldBox.current?.focus();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        submit(barDirty ? validateBar() : bar);
      }
      if (e.key === "Escape") {
        setDraft(EMPTY);
        (document.activeElement as HTMLElement | null)?.blur();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bar, barDirty]);

  function pickField(opt: FieldOpt) {
    setDraft((d) => ({
      ...d,
      category: opt.category,
      field: opt.key,
      op: (opt.ops?.[0] ?? ":") as CmpOp,
    }));
    requestAnimationFrame(() => valueBox.current?.focus());
  }

  function commitDraft() {
    if (!draft.category || !draft.value.trim()) return;
    const clause: Clause = {
      kind: "clause",
      id: draft.editId ?? uid(),
      category: draft.category,
      field: draft.field,
      op: draft.op,
      value: draft.value.trim(),
      excluded: draft.excluded,
      joinAfter: "and",
    };
    setBarDirty(false);
    if (draft.editId) setRoot((r) => replaceNode(r, draft.editId!, clause));
    else setRoot((r) => ({ ...r, join: "and", items: [...r.items, clause] }));
    setDraft(EMPTY);
  }

  function validateBar() {
    const next = parseQuery(bar, FIELD_TO_CATEGORY);
    const locked = { ...next, join: "and" as const };
    setRoot(locked);
    const out = serializeQuery(locked);
    setBar(out);
    setBarDirty(false);
    return out;
  }

  function submit(q: string) {
    const trimmed = q.trim();
    if (!trimmed) return;
    navigate(`/search/results?mode=advanced&q=${encodeURIComponent(trimmed)}&n=30`);
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.liveBar}>
        <label className={styles.liveLabel} htmlFor="adv-live">
          Syntax
        </label>
        <input
          id="adv-live"
          className={styles.liveInput}
          value={bar}
          onChange={(e) => {
            setBarDirty(true);
            setBar(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            submit(barDirty ? validateBar() : bar);
          }}
          placeholder="t:creature (c:r or c:u)"
          spellCheck={false}
        />
        <button
          type="button"
          className={`${styles.iconBtn}${barDirty ? ` ${styles.iconHot}` : ""}`}
          disabled={!barDirty}
          onClick={() => validateBar()}
          title="Apply bar to board"
        >
          ✓
        </button>
        <button type="button" className={styles.primary} onClick={() => submit(barDirty ? validateBar() : bar)}>
          Search
        </button>
        <button
          type="button"
          className={styles.ghost}
          onClick={() => {
            setRoot(emptyGroup());
            setBar("");
            setBarDirty(false);
            setDraft(EMPTY);
          }}
        >
          Clear
        </button>
      </div>

      <ClauseRow
        draft={draft}
        setDraft={setDraft}
        fieldBox={fieldBox}
        valueBox={valueBox}
        onPick={pickField}
        onSubmit={commitDraft}
      />

      <p className={styles.hint}>
        <kbd>/</kbd> field · <kbd>Enter</kbd> add token · <kbd>Ctrl</kbd>+<kbd>Enter</kbd> search · drag tokens into groups
      </p>

      {hasTokens && (
        <LogicBoard
          root={root}
          onChange={setRoot}
          onEdit={(c) => {
            setDraft({
              category: c.category,
              field: c.field,
              op: c.op,
              excluded: c.excluded,
              value: c.value,
              editId: c.id,
            });
            valueBox.current?.focus();
          }}
        />
      )}
    </div>
  );
}

function ClauseRow({
  draft,
  setDraft,
  fieldBox,
  valueBox,
  onPick,
  onSubmit,
}: {
  draft: Draft;
  setDraft: (d: Draft) => void;
  fieldBox: RefObject<HTMLInputElement | null>;
  valueBox: RefObject<HTMLInputElement | null>;
  onPick: (opt: FieldOpt) => void;
  onSubmit: () => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const [symOpen, setSymOpen] = useState(false);
  const [valueOpen, setValueOpen] = useState(false);

  const selected = FIELD_OPTS.find((f) => f.category === draft.category && f.key === draft.field);
  const allowed = opsFor(selected);
  const q = query.toLowerCase();
  const filtered = FIELD_OPTS.filter(
    (f) => !q || f.label.toLowerCase().includes(q) || f.key.toLowerCase().includes(q) || f.group.toLowerCase().includes(q)
  );
  const groups = useMemo(() => {
    const map = new Map<string, FieldOpt[]>();
    for (const f of filtered) {
      const list = map.get(f.group) ?? [];
      list.push(f);
      map.set(f.group, list);
    }
    return [...map.entries()];
  }, [filtered]);

  const flat = filtered;
  const hints = suggestionsFor(draft.category, draft.field);
  const vq = draft.value.toLowerCase();
  const valueHints = hints.filter((h) => !vq || h.toLowerCase().includes(vq)).slice(0, 8);
  const symbols = fieldAllowsSymbols(draft.category, draft.field);
  const colorMode = isColorField(selected);

  function cycleOp(dir: 1 | -1) {
    const i = Math.max(0, allowed.indexOf(draft.op));
    const next = allowed[(i + dir + allowed.length) % allowed.length];
    setDraft({ ...draft, op: next });
  }

  function onComposerKey(e: ReactKeyboardEvent) {
    if (e.key === "ArrowLeft" && !e.altKey) {
      e.preventDefault();
      cycleOp(-1);
    } else if (e.key === "ArrowRight" && !e.altKey) {
      e.preventDefault();
      cycleOp(1);
    } else if (e.key === "-" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      setDraft({ ...draft, excluded: !draft.excluded });
    }
  }

  return (
    <section className={styles.composer}>
      <div className={styles.pins}>
        {PINNED.map((key) => {
          const opt = FIELD_OPTS.find((f) => f.key === key);
          if (!opt) return null;
          const on = draft.field === opt.key && draft.category === opt.category;
          return (
            <button
              key={key}
              type="button"
              className={`${styles.pin}${on ? ` ${styles.opOn}` : ""}`}
              onClick={() => onPick(opt)}
            >
              {opt.key || "n"}
            </button>
          );
        })}
      </div>
      <div className={styles.row}>
        <div className={styles.fieldPick}>
          <input
            ref={fieldBox}
            className={styles.fieldInput}
            value={open ? query : selected?.label ?? query}
            placeholder="Field…  (type to filter)"
            onFocus={() => {
              setOpen(true);
              setQuery("");
            }}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
              setHi(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "Tab") {
                const code = (query || "").trim().toLowerCase();
                const mapped = SHORTCUTS[code];
                const hit =
                  (mapped && FIELD_OPTS.find((f) => f.key === mapped)) ||
                  FIELD_OPTS.find((f) => f.key === code);
                if (hit) {
                  e.preventDefault();
                  onPick(hit);
                  setOpen(false);
                  setQuery("");
                  requestAnimationFrame(() => valueBox.current?.focus());
                  return;
                }
                setOpen(false);
                return;
              }
              onComposerKey(e);
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setHi((i) => Math.min(i + 1, Math.max(flat.length - 1, 0)));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setHi((i) => Math.max(i - 1, 0));
              } else if (e.key === "Enter" && open && flat[hi]) {
                e.preventDefault();
                onPick(flat[hi]);
                setOpen(false);
                setQuery("");
              } else if (e.key === "Escape") {
                setOpen(false);
              }
            }}
            onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          />
          {open && (
            <div className={styles.menu} role="listbox">
              {groups.map(([group, items]) => (
                <div key={group}>
                  <div className={styles.menuGroup}>{group}</div>
                  {items.map((item) => {
                    const idx = flat.indexOf(item);
                    return (
                      <button
                        key={`${item.category}:${item.key}`}
                        type="button"
                        className={`${styles.menuItem}${idx === hi ? ` ${styles.menuOn}` : ""}`}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          onPick(item);
                          setOpen(false);
                          setQuery("");
                        }}
                      >
                        <code>{item.key || "name"}</code>
                        <span>{item.label.split(" · ").slice(-1)[0]}</span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          tabIndex={-1}
          className={`${styles.op}${draft.excluded ? ` ${styles.opOn}` : ""}`}
          onClick={() => setDraft({ ...draft, excluded: !draft.excluded })}
          title="Negate (Ctrl+-)"
        >
          −
        </button>

        <div className={styles.ops}>
          {ALL_OPS.map((o) => {
            const ok = allowed.includes(o);
            return (
              <button
                key={o}
                type="button"
                tabIndex={-1}
                disabled={!ok}
                className={`${styles.op}${draft.op === o ? ` ${styles.opOn}` : ""}${!ok ? ` ${styles.opOff}` : ""}`}
                onClick={() => ok && setDraft({ ...draft, op: o })}
              >
                {o}
              </button>
            );
          })}
        </div>

        <div className={styles.valueWrap}>
          {colorMode ? (
            <div className={styles.colorPick}>
              {COLORS.map((c) => {
                const on = draft.value.toLowerCase().includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    className={`${styles.colorBtn}${on ? ` ${styles.opOn}` : ""}`}
                    onClick={() => {
                      const letters = COLORS.map((x) => x.id).filter((id) =>
                        id === c.id ? !on : draft.value.toLowerCase().includes(id)
                      );
                      setDraft({ ...draft, value: letters.join("") });
                    }}
                  >
                    {renderManaSymbol(c.sym, 18)}
                  </button>
                );
              })}
            </div>
          ) : (
            <input
              ref={valueBox}
              className={styles.value}
              value={draft.value}
              placeholder={selected?.hint ?? "value"}
              onFocus={() => setValueOpen(true)}
              onChange={(e) => {
                setDraft({ ...draft, value: e.target.value });
                setValueOpen(true);
              }}
              onKeyDown={(e) => {
                onComposerKey(e);
                if (e.key === "Enter") {
                  e.preventDefault();
                  onSubmit();
                }
              }}
              onBlur={() => window.setTimeout(() => setValueOpen(false), 120)}
            />
          )}
          {symbols && !colorMode && (
            <button type="button" tabIndex={-1} className={styles.symBtn} onClick={() => setSymOpen((v) => !v)}>
              {"{ }"}
            </button>
          )}
          {symOpen && (
            <div className={styles.menu}>
              <button
                type="button"
                className={styles.menuItem}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setDraft({ ...draft, value: `${draft.value}~` });
                  setSymOpen(false);
                }}
              >
                ~ this name
              </button>
              {SYMBOLS.filter((s) => s.insert !== "~").map((s) => (
                <button
                  key={s.insert}
                  type="button"
                  className={styles.menuItem}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setDraft({ ...draft, value: `${draft.value}${s.insert}` });
                    setSymOpen(false);
                    valueBox.current?.focus();
                  }}
                >
                  {renderManaSymbol(s.insert, 18)}
                  <span>{s.insert}</span>
                </button>
              ))}
            </div>
          )}
          {valueOpen && valueHints.length > 0 && (
            <div className={styles.menu}>
              {valueHints.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={styles.menuItem}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setDraft({ ...draft, value: s });
                    setValueOpen(false);
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        <button type="button" className={styles.primary} disabled={!draft.value.trim()} onClick={onSubmit}>
          {draft.editId ? "Update" : "Add"}
        </button>
      </div>
    </section>
  );
}

function LogicBoard({
  root,
  onChange,
  onEdit,
}: {
  root: Group;
  onChange: (g: Group | ((prev: Group) => Group)) => void;
  onEdit: (c: Clause) => void;
}) {
  function patch(mut: (g: Group) => Group) {
    onChange((prev) => ({ ...mut(prev), join: "and" }));
  }
  function move(id: string, target: string) {
    if (id === target) return;
    onChange((prev) => {
      const loc = findNode(prev, id);
      if (!loc) return prev;
      const node = loc.parent.items[loc.index];
      if (node.kind === "group" && containsId(node, target)) return prev;
      return { ...insertInto(removeNode(prev, id), target, node), join: "and" };
    });
  }

  return (
    <section className={styles.logic}>
      <div className={styles.logicHead}>
        <h2>Board</h2>
      </div>
      <Bubble group={root} onEdit={onEdit} onMove={move} onPatch={patch} isRoot />
    </section>
  );
}

function Bubble({
  group,
  onEdit,
  onMove,
  onPatch,
  isRoot,
}: {
  group: Group;
  onEdit: (c: Clause) => void;
  onMove: (id: string, groupId: string) => void;
  onPatch: (mut: (g: Group) => Group) => void;
  isRoot?: boolean;
}) {
  return (
    <div
      className={`${styles.bubble} ${group.join === "or" ? styles.bubbleOr : styles.bubbleAnd}`}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const id = e.dataTransfer.getData("text/token");
        if (id) onMove(id, group.id);
      }}
    >
      <div className={styles.bubbleBar}>
        <button
          type="button"
          className={styles.joinMark}
          disabled={isRoot}
          onClick={() => {
            if (isRoot) return;
            onPatch((tree) =>
              replaceNode(tree, group.id, { ...group, join: group.join === "and" ? "or" : "and" })
            );
          }}
        >
          {isRoot ? "AND" : group.join.toUpperCase()}
        </button>
        <button
          type="button"
          className={styles.ghost}
          onClick={() =>
            onPatch((tree) => {
              if (isRoot || tree.id === group.id) {
                return { ...tree, items: [...tree.items, emptyGroup("or")] };
              }
              const loc = findNode(tree, group.id);
              const cur =
                loc && loc.parent.items[loc.index].kind === "group"
                  ? (loc.parent.items[loc.index] as Group)
                  : group;
              return replaceNode(tree, group.id, {
                ...cur,
                items: [...cur.items, emptyGroup("or")],
              });
            })
          }
        >
          + ( )
        </button>
        {!isRoot && (
          <button type="button" className={styles.ghost} onClick={() => onPatch((tree) => removeNode(tree, group.id))}>
            ×
          </button>
        )}
      </div>
      <div className={styles.tokens}>
        {group.items.map((n) =>
          n.kind === "clause" ? (
            <Token
              key={n.id}
              clause={n}
              onEdit={() => onEdit(n)}
              onRemove={() => onPatch((tree) => removeNode(tree, n.id))}
            />
          ) : (
            <div
              key={n.id}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData("text/token", n.id);
                e.stopPropagation();
              }}
            >
              <Bubble group={n} onEdit={onEdit} onMove={onMove} onPatch={onPatch} />
            </div>
          )
        )}
      </div>
    </div>
  );
}

function Token({
  clause,
  onEdit,
  onRemove,
}: {
  clause: Clause;
  onEdit: () => void;
  onRemove: () => void;
}) {
  return (
    <div
      className={`${styles.token}${clause.excluded ? ` ${styles.tokenNot}` : ""}`}
      draggable
      onDragStart={(e) => e.dataTransfer.setData("text/token", clause.id)}
    >
      <code>{serializeClause(clause)}</code>
      <span className={styles.tokenActs}>
        <button type="button" onClick={onEdit} title="Edit">
          ✎
        </button>
        <button type="button" onClick={onRemove} title="Remove">
          ×
        </button>
      </span>
    </div>
  );
}
