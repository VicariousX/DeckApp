import { useEffect, useMemo, useRef, useState } from "react";
import { MECHANIC_FAMILIES, MECHANICS, mechanicById, type Agency } from "../../lib/mechanics/catalog";
import form from "../../pages/LoginPage.module.css";
import styles from "./MechanicPicker.module.css";

const RELATIONS: { id: "" | Agency; label: string }[] = [
  { id: "", label: "Any" },
  { id: "cause", label: "Cause" },
  { id: "benefit", label: "Benefit" },
  { id: "both", label: "Both" },
];

const FAMILY = Object.fromEntries(MECHANIC_FAMILIES.map((f) => [f.id, f.label]));

function split(value: string): { id: string; relation: "" | Agency } {
  const [id, relation] = value.split(":");
  if (relation === "cause" || relation === "benefit" || relation === "both") {
    return { id, relation };
  }
  return { id: value, relation: "" };
}

/** One or more catalog mechanics. Each value is `id` or `id:cause`. */
export function MechanicPicker({
  value,
  onChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const pickedIds = new Set(value.map((v) => split(v).id));

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return MECHANICS.filter((m) => {
      if (pickedIds.has(m.id)) return false;
      const family = FAMILY[m.family] ?? "";
      return (
        m.name.toLowerCase().includes(q) ||
        m.id.includes(q) ||
        m.hint.toLowerCase().includes(q) ||
        family.toLowerCase().includes(q)
      );
    }).slice(0, 12);
  }, [query, value]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: PointerEvent) {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onDoc);
    return () => document.removeEventListener("pointerdown", onDoc);
  }, [open]);

  function add(id: string) {
    if (pickedIds.has(id)) return;
    onChange([...value, id]);
    setQuery("");
    setOpen(false);
  }

  function setRelation(id: string, relation: "" | Agency) {
    onChange(value.map((v) => (split(v).id === id ? (relation ? `${id}:${relation}` : id) : v)));
  }

  return (
    <div ref={box} className={styles.wrap}>
      <input
        className={form.input}
        value={query}
        placeholder={value.length ? "Add another mechanic…" : "Search mechanics…"}
        autoComplete="off"
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && matches[0]) {
            e.preventDefault();
            add(matches[0].id);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {open && matches.length > 0 ? (
        <div className={styles.menu} role="listbox">
          {matches.map((m) => (
            <button key={m.id} type="button" className={styles.option} onClick={() => add(m.id)}>
              <span>{m.name}</span>
              <span className={styles.family}>{FAMILY[m.family]}</span>
            </button>
          ))}
        </div>
      ) : null}
      {value.map((entry) => {
        const { id, relation } = split(entry);
        const def = mechanicById(id);
        return (
          <div key={id} className={styles.picked}>
            <span className={styles.chip}>
              {def?.name ?? id}
              <button type="button" aria-label={`Remove ${def?.name ?? id}`} onClick={() => onChange(value.filter((v) => split(v).id !== id))}>
                ×
              </button>
            </span>
            <span className={styles.rels} role="group" aria-label={`${def?.name ?? id} relationship`}>
              {RELATIONS.map((r) => (
                <button
                  key={r.id || "any"}
                  type="button"
                  aria-pressed={relation === r.id}
                  className={relation === r.id ? styles.relOn : styles.rel}
                  onClick={() => setRelation(id, r.id)}
                >
                  {r.label}
                </button>
              ))}
            </span>
          </div>
        );
      })}
    </div>
  );
}
