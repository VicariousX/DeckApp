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

/** Searchable catalog mechanic, stored as `id` or `id:cause`. */
export function MechanicPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const { id, relation } = split(value);
  const picked = id ? mechanicById(id) : undefined;
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return MECHANICS.filter((m) => {
      const family = FAMILY[m.family] ?? "";
      return (
        m.name.toLowerCase().includes(q) ||
        m.id.includes(q) ||
        m.hint.toLowerCase().includes(q) ||
        family.toLowerCase().includes(q)
      );
    }).slice(0, 12);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: PointerEvent) {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onDoc);
    return () => document.removeEventListener("pointerdown", onDoc);
  }, [open]);

  function choose(nextId: string) {
    onChange(relation ? `${nextId}:${relation}` : nextId);
    setQuery("");
    setOpen(false);
  }

  function setRelation(next: "" | Agency) {
    if (!id) return;
    onChange(next ? `${id}:${next}` : id);
  }

  return (
    <div ref={box} className={styles.wrap}>
      <input
        className={form.input}
        value={query}
        placeholder={picked ? "Change mechanic…" : "Search mechanics…"}
        autoComplete="off"
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && matches[0]) {
            e.preventDefault();
            choose(matches[0].id);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {open && matches.length > 0 ? (
        <div className={styles.menu} role="listbox">
          {matches.map((m) => (
            <button key={m.id} type="button" className={styles.option} onClick={() => choose(m.id)}>
              <span>{m.name}</span>
              <span className={styles.family}>{FAMILY[m.family]}</span>
            </button>
          ))}
        </div>
      ) : null}
      {id ? (
        <div className={styles.picked}>
          <span className={styles.chip}>
            {picked?.name ?? id}
            <button type="button" aria-label="Remove mechanic" onClick={() => onChange("")}>
              ×
            </button>
          </span>
          <span className={styles.rels} role="group" aria-label="Relationship">
            {RELATIONS.map((r) => (
              <button
                key={r.id || "any"}
                type="button"
                aria-pressed={relation === r.id}
                className={relation === r.id ? styles.relOn : styles.rel}
                onClick={() => setRelation(r.id)}
              >
                {r.label}
              </button>
            ))}
          </span>
        </div>
      ) : null}
    </div>
  );
}
