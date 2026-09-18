import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
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

const OPS: CmpOp[] = [":", "=", ">", "<", ">=", "<=", "!="];

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
    fieldBox.current?.focus();
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

  const selected = FIELD_OPTS.find((f) => f.category === draft.category && f.key === draft.field);
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
  const ops = selected?.ops ?? OPS;
  const hints = suggestionsFor(draft.category, draft.field);
  const vq = draft.value.toLowerCase();
  const valueHints = hints.filter((h) => !vq || h.toLowerCase().includes(vq)).slice(0, 8);
  const symbols = fieldAllowsSymbols(draft.category, draft.field);

  return (
    <section className={styles.composer}>
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
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setHi((i) => Math.min(i + 1, flat.length - 1));
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
          className={`${styles.op}${draft.excluded ? ` ${styles.opOn}` : ""}`}
          onClick={() => setDraft({ ...draft, excluded: !draft.excluded })}
          title="Negate"
        >
          −
        </button>

        <div className={styles.ops}>
          {ops.map((o) => (
            <button
              key={o}
              type="button"
              className={`${styles.op}${draft.op === o ? ` ${styles.opOn}` : ""}`}
              onClick={() => setDraft({ ...draft, op: o })}
            >
              {o}
            </button>
          ))}
        </div>

        <div className={styles.valueWrap}>
          <input
            ref={valueBox}
            className={styles.value}
            value={draft.value}
            placeholder={selected?.hint ?? "value"}
            onChange={(e) => setDraft({ ...draft, value: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onSubmit();
              }
            }}
          />
          {symbols && (
            <button type="button" className={styles.symBtn} onClick={() => setSymOpen((v) => !v)}>
              {"{ }"}
            </button>
          )}
          {symOpen && (
            <div className={styles.menu}>
              {SYMBOLS.map((s) => (
                <button
                  key={s.insert}
                  type="button"
                  className={styles.menuItem}
                  onClick={() => {
                    setDraft({ ...draft, value: `${draft.value}${s.insert}` });
                    setSymOpen(false);
                    valueBox.current?.focus();
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}
          {valueHints.length > 0 && draft.value && (
            <div className={styles.menu}>
              {valueHints.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={styles.menuItem}
                  onClick={() => setDraft({ ...draft, value: s })}
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
        <button type="button" className={styles.ghost} onClick={() => patch((g) => ({ ...g, items: [...g.items, emptyGroup("or")] }))}>
          + ( )
        </button>
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
        <span className={styles.joinMark}>{isRoot ? "AND" : group.join.toUpperCase()}</span>
        {!isRoot && (
          <button
            type="button"
            className={styles.ghost}
            onClick={() =>
              onPatch((tree) =>
                replaceNode(tree, group.id, { ...group, join: group.join === "and" ? "or" : "and" })
              )
            }
          >
            {group.join === "and" ? "→ OR" : "→ AND"}
          </button>
        )}
        <button
          type="button"
          className={styles.ghost}
          onClick={() =>
            onPatch((tree) => replaceNode(tree, group.id, { ...group, items: [...group.items, emptyGroup("or")] }))
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
              onNegate={() => onPatch((tree) => replaceNode(tree, n.id, { ...n, excluded: !n.excluded }))}
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
  onNegate,
  onRemove,
}: {
  clause: Clause;
  onEdit: () => void;
  onNegate: () => void;
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
        <button type="button" onClick={onNegate} title="Negate">
          −
        </button>
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
