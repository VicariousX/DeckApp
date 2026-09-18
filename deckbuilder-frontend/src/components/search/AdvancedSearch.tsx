import { useEffect, useMemo, useRef, useState } from "react";
import { CATEGORIES, FIELD_TO_CATEGORY, type FieldDef } from "../../lib/search/categories";
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
import { useScryfallSearch } from "../../hooks/useScryfallSearch";
import type { ScryfallCard } from "../../types/scryfallCard";
import styles from "./AdvancedSearch.module.css";

const COLORS = [
  { id: "w", label: "White" },
  { id: "u", label: "Blue" },
  { id: "b", label: "Black" },
  { id: "r", label: "Red" },
  { id: "g", label: "Green" },
  { id: "c", label: "Colorless" },
];

type Props = {
  onResults: (cards: ScryfallCard[]) => void;
  initialQuery?: string;
  onQueryChange?: (q: string) => void;
};

export function AdvancedSearch({ onResults, initialQuery = "", onQueryChange }: Props) {
  const [root, setRoot] = useState<Group>(() =>
    parseQuery(initialQuery, FIELD_TO_CATEGORY)
  );
  const [bar, setBar] = useState(initialQuery);
  const [openCats, setOpenCats] = useState<Record<string, boolean>>({
    colors: true,
    type: true,
    text: true,
  });
  const editingBar = useRef(false);
  const parseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const serialized = useMemo(() => serializeQuery(root), [root]);

  useEffect(() => {
    if (editingBar.current) return;
    setBar(serialized);
    onQueryChange?.(serialized);
  }, [serialized, onQueryChange]);

  const { cards, isLoading, isError } = useScryfallSearch(bar);

  useEffect(() => {
    onResults(cards);
  }, [cards, onResults]);

  function applyBar(next: string) {
    setBar(next);
    onQueryChange?.(next);
    if (parseTimer.current) clearTimeout(parseTimer.current);
    parseTimer.current = setTimeout(() => {
      editingBar.current = false;
      setRoot(parseQuery(next, FIELD_TO_CATEGORY));
    }, 280);
  }

  function setCategoryGroup(catId: string, group: Group) {
    setRoot((prev) => {
      const others = prev.items.filter((n) =>
        n.kind === "group"
          ? !n.items.every((i) => i.kind === "clause" && i.category === catId) &&
            !(n.items.length && n.items.every((i) => i.kind === "clause" && i.category === catId))
          : !(n.kind === "clause" && n.category === catId)
      );
      const cleaned: Group = {
        ...prev,
        items: others.filter((n) => {
          if (n.kind === "clause") return n.category !== catId;
          return true;
        }),
      };
      // drop leftover clauses of this category anywhere
      const strip = (g: Group): Group => ({
        ...g,
        items: g.items
          .filter((n) => !(n.kind === "clause" && n.category === catId))
          .map((n) => (n.kind === "group" ? strip(n) : n))
          .filter((n) => n.kind === "clause" || n.items.length > 0),
      });
      const base = strip(cleaned);
      if (group.items.length === 0) return base;
      return { ...base, items: [...base.items, { ...group, id: group.id || uid() }] };
    });
  }

  const byCat = useMemo(() => {
    const map: Record<string, Group> = {};
    for (const cat of CATEGORIES) map[cat.id] = emptyGroup("and");
    function walk(n: Group) {
      const only = n.items.filter((i) => i.kind === "clause") as Clause[];
      if (
        n.items.length &&
        only.length === n.items.length &&
        only.every((c) => c.category === only[0]?.category)
      ) {
        const cat = only[0].category;
        if (map[cat] && map[cat].items.length === 0) {
          map[cat] = n;
          return;
        }
      }
      for (const item of n.items) {
        if (item.kind === "clause") {
          const g = map[item.category] ?? emptyGroup();
          g.items.push(item);
          map[item.category] = g;
        } else {
          walk(item);
        }
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
            editingBar.current = true;
            applyBar(e.target.value);
          }}
          onBlur={() => {
            editingBar.current = false;
            setRoot(parseQuery(bar, FIELD_TO_CATEGORY));
          }}
          placeholder='Build a query — e.g. t:creature id<=wug o:"draw a card"'
          spellCheck={false}
        />
        <button
          type="button"
          className={styles.clearBtn}
          onClick={() => {
            editingBar.current = false;
            setRoot(emptyGroup());
            setBar("");
            onQueryChange?.("");
          }}
        >
          Clear
        </button>
        <span className={styles.status}>
          {isLoading ? "Searching…" : isError ? "Search failed" : bar.trim() ? `${cards.length} shown` : ""}
        </span>
      </div>

      <div className={styles.cats}>
        {CATEGORIES.filter((c) => c.id !== "custom" || byCat.custom.items.length > 0).map(
          (cat) => (
            <CategoryPanel
              key={cat.id}
              def={cat}
              group={byCat[cat.id] ?? emptyGroup()}
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
  const preview = serializeQuery(group);
  const defaultField = def.fields[0]?.key ?? "";

  function patchItem(id: string, next: Clause) {
    onChange({
      ...group,
      items: group.items.map((n) => (n.kind === "clause" && n.id === id ? next : n)),
    });
  }

  function removeItem(id: string) {
    onChange({ ...group, items: group.items.filter((n) => n.id !== id) });
  }

  return (
    <section className={styles.cat}>
      <button type="button" className={styles.catHead} onClick={onToggle} aria-expanded={open}>
        <span>{def.label}</span>
        <code className={styles.catPreview}>{preview || "—"}</code>
      </button>
      {open && (
        <div className={styles.catBody}>
          <div className={styles.joinRow}>
            <span>Combine with</span>
            <button
              type="button"
              className={`${styles.chip}${group.join === "and" ? ` ${styles.chipOn}` : ""}`}
              onClick={() => onChange({ ...group, join: "and" })}
            >
              AND
            </button>
            <button
              type="button"
              className={`${styles.chip}${group.join === "or" ? ` ${styles.chipOn}` : ""}`}
              onClick={() => onChange({ ...group, join: "or" })}
            >
              OR
            </button>
            <button
              type="button"
              className={styles.addBtn}
              onClick={() =>
                onChange({
                  ...group,
                  items: [...group.items, emptyClause(def.id, defaultField)],
                })
              }
            >
              + Clause
            </button>
          </div>
          {group.items
            .filter((n): n is Clause => n.kind === "clause")
            .map((clause) => (
              <ClauseRow
                key={clause.id}
                clause={clause}
                fields={def.fields}
                onChange={(c) => patchItem(clause.id, c)}
                onRemove={() => removeItem(clause.id)}
              />
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
}: {
  clause: Clause;
  fields: FieldDef[];
  onChange: (c: Clause) => void;
  onRemove: () => void;
}) {
  const field = fields.find((f) => f.key === clause.field) ?? fields[0];
  const ops: CmpOp[] = field?.ops ?? [":", "="];

  return (
    <div className={styles.clause}>
      <button
        type="button"
        className={`${styles.chip}${clause.excluded ? ` ${styles.chipOn}` : ""}`}
        onClick={() => onChange({ ...clause, excluded: !clause.excluded })}
        title="Exclude"
      >
        {clause.excluded ? "NOT" : "IS"}
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
            {o}
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
      <button type="button" className={styles.remove} onClick={onRemove} aria-label="Remove">
        ×
      </button>
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
