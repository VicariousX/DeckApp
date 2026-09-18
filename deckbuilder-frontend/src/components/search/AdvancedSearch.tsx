import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CATEGORIES, FIELD_TO_CATEGORY, type FieldDef } from "../../lib/search/categories";
import { OP_LABELS } from "../../lib/search/operators";
import {
  emptyClause,
  emptyGroup,
  parseQuery,
  serializeQuery,
  type Clause,
  type CmpOp,
  type Group,
  uid,
} from "../../lib/search/syntaxModel";
import styles from "./AdvancedSearch.module.css";

const COLORS = [
  { id: "w", label: "White" },
  { id: "u", label: "Blue" },
  { id: "b", label: "Black" },
  { id: "r", label: "Red" },
  { id: "g", label: "Green" },
  { id: "c", label: "Colorless" },
];

function ensureDraft(group: Group, catId: string, field: string): Group {
  const clauses = group.items.filter((n): n is Clause => n.kind === "clause");
  if (clauses.length === 0) {
    return { ...group, items: [emptyClause(catId, field)] };
  }
  const last = clauses[clauses.length - 1];
  if (last.value.trim()) {
    return { ...group, items: [...group.items, emptyClause(catId, field)] };
  }
  return group;
}

export function AdvancedSearch({ initialQuery = "" }: { initialQuery?: string }) {
  const navigate = useNavigate();
  const [root, setRoot] = useState<Group>(() =>
    parseQuery(initialQuery, FIELD_TO_CATEGORY)
  );
  const [bar, setBar] = useState(initialQuery);
  const [barDirty, setBarDirty] = useState(false);
  const [openCats, setOpenCats] = useState<Record<string, boolean>>({
    colors: true,
    type: true,
    text: true,
  });

  const serialized = useMemo(() => serializeQuery(root), [root]);

  useEffect(() => {
    if (barDirty) return;
    setBar(serialized);
  }, [serialized, barDirty]);

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
    navigate(
      `/search/results?mode=advanced&q=${encodeURIComponent(trimmed)}&n=30`
    );
  }

  function setCategoryGroup(catId: string, group: Group) {
    setBarDirty(false);
    setRoot((prev) => {
      const strip = (g: Group): Group => ({
        ...g,
        items: g.items
          .filter((n) => !(n.kind === "clause" && n.category === catId))
          .map((n) => (n.kind === "group" ? strip(n) : n))
          .filter((n) => n.kind === "clause" || n.items.length > 0),
      });
      const base = strip(prev);
      const filled = group.items.filter(
        (n) => n.kind !== "clause" || n.value.trim()
      );
      if (filled.length === 0) return base;
      return { ...base, items: [...base.items, { ...group, id: group.id || uid(), items: filled }] };
    });
  }

  const byCat = useMemo(() => {
    const map: Record<string, Group> = {};
    for (const cat of CATEGORIES) map[cat.id] = emptyGroup("and");
    function walk(n: Group) {
      for (const item of n.items) {
        if (item.kind === "clause") {
          const g = map[item.category] ?? emptyGroup();
          g.items.push(item);
          map[item.category] = g;
        } else walk(item);
      }
    }
    walk(root);
    return map;
  }, [root]);

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
            const q = barDirty ? validateBar() : bar;
            submit(q);
          }}
          placeholder='Build a query — e.g. t:creature id<=wug o:"draw a card"'
          spellCheck={false}
        />
        <button
          type="button"
          className={`${styles.validateBtn}${barDirty ? ` ${styles.validateHot}` : ""}`}
          onClick={() => validateBar()}
          title="Validate syntax into the panels"
          disabled={!barDirty}
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
            setBarDirty(false);
            setRoot(emptyGroup());
            setBar("");
          }}
        >
          Clear
        </button>
      </div>

      <div className={styles.cats}>
        {CATEGORIES.filter((c) => c.id !== "custom" || byCat.custom.items.length > 0).map(
          (cat) => (
            <CategoryPanel
              key={cat.id}
              def={cat}
              group={ensureDraft(
                byCat[cat.id] ?? emptyGroup(),
                cat.id,
                cat.fields[0]?.key ?? ""
              )}
              open={Boolean(openCats[cat.id])}
              onToggle={() =>
                setOpenCats((s) => ({ ...s, [cat.id]: !s[cat.id] }))
              }
              onChange={(g) => setCategoryGroup(cat.id, g)}
            />
          )
        )}
      </div>
    </div>
  );
}

function CategoryPanel({
  def,
  group,
  open,
  onToggle,
  onChange,
}: {
  def: (typeof CATEGORIES)[number];
  group: Group;
  open: boolean;
  onToggle: () => void;
  onChange: (g: Group) => void;
}) {
  const preview = serializeQuery({
    ...group,
    items: group.items.filter((n) => n.kind !== "clause" || n.value.trim()),
  });
  const defaultField = def.fields[0]?.key ?? "";
  const clauses = group.items.filter((n): n is Clause => n.kind === "clause");

  function patch(id: string, next: Clause) {
    const items = group.items.map((n) =>
      n.kind === "clause" && n.id === id ? next : n
    ) as Group["items"];
    let g: Group = { ...group, items };
    g = ensureDraft(g, def.id, defaultField);
    onChange(g);
  }

  return (
    <section className={styles.cat}>
      <button type="button" className={styles.catHead} onClick={onToggle} aria-expanded={open}>
        <span>{def.label}</span>
        <code className={styles.catPreview}>{preview || "—"}</code>
      </button>
      {open && (
        <div className={styles.catBody}>
          {clauses.map((clause, i) => (
            <div key={clause.id}>
              <ClauseRow
                clause={clause}
                fields={def.fields}
                onChange={(c) => patch(clause.id, c)}
                onRemove={() =>
                  onChange({
                    ...group,
                    items: group.items.filter((n) => n.id !== clause.id),
                  })
                }
                canRemove={Boolean(clause.value.trim())}
              />
              {i < clauses.length - 1 && (
                <div className={styles.joinRow}>
                  <button
                    type="button"
                    className={`${styles.chip}${clause.joinAfter === "and" ? ` ${styles.chipOn}` : ""}`}
                    onClick={() => patch(clause.id, { ...clause, joinAfter: "and" })}
                  >
                    AND
                  </button>
                  <button
                    type="button"
                    className={`${styles.chip}${clause.joinAfter === "or" ? ` ${styles.chipOn}` : ""}`}
                    onClick={() => patch(clause.id, { ...clause, joinAfter: "or" })}
                  >
                    OR
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function ClauseRow({
  clause,
  fields,
  onChange,
  onRemove,
  canRemove,
}: {
  clause: Clause;
  fields: FieldDef[];
  onChange: (c: Clause) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const field = fields.find((f) => f.key === clause.field) ?? fields[0];
  const ops: CmpOp[] = field?.ops ?? [":", "="];

  return (
    <div className={styles.clause}>
      <button
        type="button"
        className={`${styles.chip}${clause.excluded ? ` ${styles.chipOn}` : ""}`}
        onClick={() => onChange({ ...clause, excluded: !clause.excluded })}
      >
        {clause.excluded ? "excluding" : "including"}
      </button>
      <select
        className={styles.select}
        value={clause.field}
        onChange={(e) => onChange({ ...clause, field: e.target.value })}
      >
        {fields.map((f) => (
          <option key={f.key || "_bare"} value={f.key}>
            {f.label}
          </option>
        ))}
      </select>
      <select
        className={styles.select}
        value={clause.op}
        onChange={(e) => onChange({ ...clause, op: e.target.value as CmpOp })}
      >
        {ops.map((o) => (
          <option key={o} value={o}>
            {OP_LABELS.find((x) => x.op === o)?.label ?? o}
          </option>
        ))}
      </select>
      {field?.kind === "colors" ? (
        <ColorValue
          value={clause.value}
          onChange={(value) => onChange({ ...clause, value })}
        />
      ) : field?.kind === "select" && field.options ? (
        <select
          className={styles.select}
          value={clause.value}
          onChange={(e) => onChange({ ...clause, value: e.target.value })}
        >
          <option value="">Choose…</option>
          {field.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          className={styles.value}
          value={clause.value}
          placeholder={field?.hint ?? "value"}
          onChange={(e) => onChange({ ...clause, value: e.target.value })}
        />
      )}
      {canRemove && (
        <button type="button" className={styles.remove} onClick={onRemove} aria-label="Remove">
          ×
        </button>
      )}
    </div>
  );
}

function ColorValue({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const lower = value.toLowerCase();
  return (
    <div className={styles.colorRow}>
      {COLORS.map((c) => {
        const on = lower.includes(c.id);
        return (
          <button
            key={c.id}
            type="button"
            className={`${styles.colorChip}${on ? ` ${styles.chipOn}` : ""}`}
            onClick={() => {
              const letters = COLORS.map((x) => x.id).filter((id) =>
                id === c.id ? !on : lower.includes(id)
              );
              onChange(letters.join(""));
            }}
          >
            {c.label}
          </button>
        );
      })}
    </div>
  );
}



