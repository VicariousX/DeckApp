import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CATEGORIES, FIELD_TO_CATEGORY } from "../../lib/search/categories";
import { OP_LABELS } from "../../lib/search/operators";
import {
  fieldAllowsSymbols,
  suggestionsFor,
} from "../../lib/search/autocomplete";
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

const SYMBOLS: { insert: string; label: string }[] = [
  { insert: "~", label: "this card's name (~)" },
  { insert: "{W}", label: "White" },
  { insert: "{U}", label: "Blue" },
  { insert: "{B}", label: "Black" },
  { insert: "{R}", label: "Red" },
  { insert: "{G}", label: "Green" },
  { insert: "{C}", label: "Colorless" },
  { insert: "{S}", label: "Snow" },
  { insert: "{X}", label: "X" },
  { insert: "{T}", label: "Tap" },
  { insert: "{Q}", label: "Untap" },
  { insert: "{E}", label: "Energy" },
  { insert: "{P}", label: "Phyrexian" },
  { insert: "{W/U}", label: "W/U" },
  { insert: "{W/B}", label: "W/B" },
  { insert: "{U/B}", label: "U/B" },
  { insert: "{U/R}", label: "U/R" },
  { insert: "{B/R}", label: "B/R" },
  { insert: "{B/G}", label: "B/G" },
  { insert: "{R/G}", label: "R/G" },
  { insert: "{R/W}", label: "R/W" },
  { insert: "{G/W}", label: "G/W" },
  { insert: "{G/U}", label: "G/U" },
];

type Draft = {
  category: string;
  field: string;
  op: CmpOp;
  excluded: boolean;
  value: string;
  editId?: string;
};

const EMPTY_DRAFT: Draft = {
  category: "",
  field: "",
  op: ":",
  excluded: false,
  value: "",
};

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

function insertInto(root: Group, groupId: string, node: Node): Group {
  if (root.id === groupId) return { ...root, items: [...root.items, node] };
  return {
    ...root,
    items: root.items.map((n) =>
      n.kind === "group" ? insertInto(n, groupId, node) : n
    ),
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

function tokenLabel(c: Clause): string {
  const cat = CATEGORIES.find((x) => x.id === c.category);
  const field = cat?.fields.find((f) => f.key === c.field);
  const op = OP_LABELS.find((o) => o.op === c.op)?.label ?? c.op;
  return `${c.excluded ? "not " : ""}${field?.label ?? c.field} ${op} ${c.value}`.trim();
}

export function AdvancedSearch({ initialQuery = "" }: { initialQuery?: string }) {
  const navigate = useNavigate();
  const [root, setRoot] = useState<Group>(() =>
    parseQuery(initialQuery, FIELD_TO_CATEGORY)
  );
  const [bar, setBar] = useState(initialQuery);
  const [barDirty, setBarDirty] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [step, setStep] = useState<"category" | "field" | "value">("category");

  const serialized = useMemo(() => serializeQuery(root), [root]);
  const hasTokens = serialized.trim().length > 0;

  useEffect(() => {
    if (!barDirty) setBar(serialized);
  }, [serialized, barDirty]);

  const cat = CATEGORIES.find((c) => c.id === draft.category);
  const fields = cat?.fields ?? [];

  function pickCategory(id: string) {
    const next = CATEGORIES.find((c) => c.id === id);
    const first = next?.fields[0]?.key ?? "";
    setDraft({
      ...EMPTY_DRAFT,
      category: id,
      field: next && next.fields.length === 1 ? first : "",
    });
    setStep(next && next.fields.length > 1 ? "field" : "value");
  }

  function pickField(key: string) {
    setDraft((d) => ({ ...d, field: key }));
    setStep("value");
  }

  function commitDraft() {
    if (!draft.category || !draft.value.trim()) return;
    const field = draft.field || fields[0]?.key || "";
    const clause: Clause = {
      kind: "clause",
      id: draft.editId ?? uid(),
      category: draft.category,
      field,
      op: draft.op,
      value: draft.value.trim(),
      excluded: draft.excluded,
      joinAfter: "and",
    };
    setBarDirty(false);
    if (draft.editId) {
      setRoot((r) => replaceNode(r, draft.editId!, clause));
    } else {
      setRoot((r) => ({ ...r, items: [...r.items, clause] }));
    }
    setDraft(EMPTY_DRAFT);
    setStep("category");
  }

  function validateBar() {
    const next = parseQuery(bar, FIELD_TO_CATEGORY);
    setRoot(next);
    setBar(serializeQuery(next));
    setBarDirty(false);
    return serializeQuery(next);
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
          Live syntax
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
          placeholder="Tokens parse here as you build…"
          spellCheck={false}
        />
        <button
          type="button"
          className={`${styles.validateBtn}${barDirty ? ` ${styles.validateHot}` : ""}`}
          disabled={!barDirty}
          onClick={() => validateBar()}
        >
          ✓
        </button>
        <button
          type="button"
          className={styles.clearBtn}
          onClick={() => submit(barDirty ? validateBar() : bar)}
        >
          Search
        </button>
        <button
          type="button"
          className={styles.clearBtn}
          onClick={() => {
            setRoot(emptyGroup());
            setBar("");
            setBarDirty(false);
            setDraft(EMPTY_DRAFT);
            setStep("category");
          }}
        >
          Clear
        </button>
      </div>

      <ClauseTemplate
        draft={draft}
        step={step}
        onPickCategory={pickCategory}
        onPickField={pickField}
        onChange={setDraft}
        onSubmit={commitDraft}
      />

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
            setStep("value");
          }}
        />
      )}
    </div>
  );
}

function ClauseTemplate({
  draft,
  step,
  onPickCategory,
  onPickField,
  onChange,
  onSubmit,
}: {
  draft: Draft;
  step: "category" | "field" | "value";
  onPickCategory: (id: string) => void;
  onPickField: (key: string) => void;
  onChange: (d: Draft) => void;
  onSubmit: () => void;
}) {
  const cat = CATEGORIES.find((c) => c.id === draft.category);
  const fields = cat?.fields ?? [];
  const hints = suggestionsFor(draft.category, draft.field);
  const symbols = fieldAllowsSymbols(draft.category, draft.field);
  const inputRef = useRef<HTMLInputElement>(null);
  const fieldRef = useRef<HTMLSelectElement>(null);
  const [symOpen, setSymOpen] = useState(false);
  const [suggest, setSuggest] = useState<string[]>([]);

  useEffect(() => {
    if (step === "field") fieldRef.current?.focus();
    if (step === "value") inputRef.current?.focus();
  }, [step, draft.category, draft.field]);

  useEffect(() => {
    const q = draft.value.toLowerCase();
    setSuggest(hints.filter((h) => !q || h.toLowerCase().includes(q)).slice(0, 8));
  }, [draft.value, hints]);

  return (
    <section className={styles.template}>
      <p className={styles.templateLabel}>
        {draft.editId ? "Edit clause" : "New clause"}
      </p>
      <div className={styles.templateRow}>
        <select
          className={`${styles.select}${step === "category" ? ` ${styles.hot}` : ""}`}
          value={draft.category}
          onChange={(e) => onPickCategory(e.target.value)}
        >
          <option value="">Category…</option>
          {CATEGORIES.filter((c) => c.id !== "custom").map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>

        {draft.category && fields.length > 1 && (
          <select
            ref={fieldRef}
            className={`${styles.select}${step === "field" ? ` ${styles.hot}` : ""}`}
            value={draft.field}
            onChange={(e) => onPickField(e.target.value)}
          >
            <option value="">Which field…</option>
            {fields.map((f) => (
              <option key={f.key || "_"} value={f.key}>
                {f.label}
              </option>
            ))}
          </select>
        )}

        {draft.category && (fields.length === 1 || draft.field) && (
          <>
            <select
              className={styles.select}
              value={draft.op}
              onChange={(e) => onChange({ ...draft, op: e.target.value as CmpOp })}
            >
              {(fields.find((f) => f.key === draft.field)?.ops ?? [":", "="]).map((o) => (
                <option key={o} value={o}>
                  {OP_LABELS.find((x) => x.op === o)?.label ?? o}
                </option>
              ))}
            </select>
            <button
              type="button"
              className={`${styles.chip}${draft.excluded ? ` ${styles.chipOn}` : ""}`}
              onClick={() => onChange({ ...draft, excluded: !draft.excluded })}
            >
              {draft.excluded ? "excluding" : "including"}
            </button>
            <div className={styles.valueWrap}>
              <input
                ref={inputRef}
                className={`${styles.value}${step === "value" ? ` ${styles.hot}` : ""}`}
                value={draft.value}
                placeholder={cat?.fields.find((f) => f.key === draft.field)?.hint ?? "value"}
                onChange={(e) => onChange({ ...draft, value: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    onSubmit();
                  }
                }}
              />
              {symbols && (
                <button
                  type="button"
                  className={styles.symBtn}
                  onClick={() => setSymOpen((v) => !v)}
                  title="Insert symbol"
                >
                  {"{ }"}
                </button>
              )}
              {symOpen && (
                <div className={styles.symMenu}>
                  {SYMBOLS.map((s) => (
                    <button
                      key={s.insert}
                      type="button"
                      onClick={() => {
                        onChange({ ...draft, value: `${draft.value}${s.insert}` });
                        setSymOpen(false);
                        inputRef.current?.focus();
                      }}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              )}
              {suggest.length > 0 && draft.value && (
                <ul className={styles.suggest}>
                  {suggest.map((s) => (
                    <li key={s}>
                      <button
                        type="button"
                        onClick={() => {
                          onChange({ ...draft, value: s });
                          inputRef.current?.focus();
                        }}
                      >
                        {s}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <button
              type="button"
              className={styles.clearBtn}
              disabled={!draft.value.trim()}
              onClick={onSubmit}
            >
              {draft.editId ? "Update" : "Add token"}
            </button>
          </>
        )}
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
  onChange: (g: Group) => void;
  onEdit: (c: Clause) => void;
}) {
  function patch(mut: (g: Group) => Group) {
    onChange(mut(root));
  }

  function move(id: string, targetGroupId: string) {
    const loc = findNode(root, id);
    if (!loc) return;
    const node = loc.parent.items[loc.index];
    onChange(insertInto(removeNode(root, id), targetGroupId, node));
  }

  return (
    <section className={styles.logic}>
      <div className={styles.logicHead}>
        <h2>Logic</h2>
        <button
          type="button"
          className={styles.chip}
          onClick={() =>
            patch((g) => ({ ...g, items: [...g.items, emptyGroup("and")] }))
          }
        >
          + AND group
        </button>
        <button
          type="button"
          className={styles.chip}
          onClick={() =>
            patch((g) => ({ ...g, items: [...g.items, emptyGroup("or")] }))
          }
        >
          + OR group
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
        <span>{isRoot ? "Root" : group.join.toUpperCase()} group</span>
        <button
          type="button"
          className={styles.chip}
          onClick={() =>
            onPatch((root) =>
              replaceNode(root, group.id, {
                ...group,
                join: group.join === "and" ? "or" : "and",
              })
            )
          }
        >
          Combine with {group.join === "and" ? "OR" : "AND"}
        </button>
        {!isRoot && (
          <button
            type="button"
            className={styles.chip}
            onClick={() => onPatch((root) => removeNode(root, group.id))}
          >
            Remove group
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
              onNegate={() =>
                onPatch((root) =>
                  replaceNode(root, n.id, { ...n, excluded: !n.excluded })
                )
              }
              onRemove={() => onPatch((root) => removeNode(root, n.id))}
            />
          ) : (
            <Bubble
              key={n.id}
              group={n}
              onEdit={onEdit}
              onMove={onMove}
              onPatch={onPatch}
            />
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
      onDragStart={(e) => {
        e.dataTransfer.setData("text/token", clause.id);
      }}
    >
      <code className={styles.tokenSyntax}>{serializeClause(clause)}</code>
      <span className={styles.tokenWords}>{tokenLabel(clause)}</span>
      <div className={styles.tokenActs}>
        <button type="button" onClick={onNegate}>
          {clause.excluded ? "Include" : "Negate"}
        </button>
        <button type="button" onClick={onEdit}>
          Edit
        </button>
        <button type="button" onClick={onRemove}>
          ×
        </button>
      </div>
    </div>
  );
}
