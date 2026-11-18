import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import {
  AGENCY,
  AGENCY_LABEL,
  MECHANIC_FAMILIES,
  MECHANICS,
  mechanicById,
  type Agency,
  type Economy,
  type Flow,
  type MechanicFamily,
} from "../lib/mechanics/catalog";
import {
  isCurrentUserAdmin,
  listMarksForOracle,
  lockMark,
  proposeMark,
  voteMark,
  type MarkStatus,
  type MechanicMark,
} from "../services/mechanicMarkService";
import styles from "./MechanicMarkPicker.module.css";

type Props = { oracleId: string };

const STATUS_LABEL: Record<MarkStatus, string> = {
  proposed: "Proposed",
  accepted: "Accepted",
  locked: "Locked",
  flagged: "Flagged",
  rejected: "Rejected",
};

function storedRelation(relation: Agency): { economy: Economy; flow: Flow; agency: Agency } {
  if (relation === "benefit") return { economy: "payoff", flow: "both", agency: "benefit" };
  if (relation === "both") return { economy: "both", flow: "both", agency: "both" };
  return { economy: "producer", flow: "both", agency: "cause" };
}

function ThemeSelect({
  label,
  placeholder,
  value,
  options,
  disabled,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  options: { id: string; label: string; hint?: string }[];
  disabled?: boolean;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const [box, setBox] = useState<{ top: number; left: number; width: number; up: boolean } | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: PointerEvent) {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onDoc);
    return () => document.removeEventListener("pointerdown", onDoc);
  }, [open]);

  const shown = useMemo(() => {
    const s = filter.trim().toLowerCase();
    if (!s) return options;
    return options.filter(
      (o) => o.label.toLowerCase().includes(s) || o.hint?.toLowerCase().includes(s)
    );
  }, [filter, options]);

  const current = options.find((o) => o.id === value);

  function toggle() {
    if (disabled) return;
    if (open) {
      setOpen(false);
      return;
    }
    const rect = button.current?.getBoundingClientRect();
    if (!rect) return;
    const below = window.innerHeight - rect.bottom;
    setBox({
      top: below < 220 ? rect.top - 4 : rect.bottom + 4,
      left: rect.left,
      width: rect.width,
      up: below < 220,
    });
    setFilter("");
    setOpen(true);
  }

  return (
    <div className={styles.field} ref={root}>
      <span className={styles.fieldLabel}>{label}</span>
      <button
        ref={button}
        type="button"
        className={styles.selectBtn}
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={toggle}
      >
        <span className={current ? undefined : styles.placeholder}>
          {current?.label ?? placeholder}
        </span>
        <i className={styles.caret} />
      </button>
      {open && box ? (
        <div
          className={styles.menu}
          role="listbox"
          style={{
            top: box.up ? undefined : box.top,
            bottom: box.up ? window.innerHeight - box.top : undefined,
            left: box.left,
            width: box.width,
          }}
        >
          {options.length > 8 ? (
            <input
              className={styles.menuSearch}
              value={filter}
              placeholder="Filter"
              aria-label={`Filter ${label}`}
              autoFocus
              onChange={(e) => setFilter(e.target.value)}
            />
          ) : null}
          <div className={styles.menuList}>
            {shown.length === 0 ? (
              <p className={styles.empty}>Nothing matches.</p>
            ) : (
              shown.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  role="option"
                  aria-selected={o.id === value}
                  className={o.id === value ? styles.optionOn : styles.option}
                  onClick={() => {
                    onChange(o.id);
                    setOpen(false);
                  }}
                >
                  <span>{o.label}</span>
                  {o.hint ? <small>{o.hint}</small> : null}
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function MechanicMarkPicker({ oracleId }: Props) {
  const { user } = useAuth();
  const [marks, setMarks] = useState<MechanicMark[]>([]);
  const [admin, setAdmin] = useState(false);
  const [family, setFamily] = useState<MechanicFamily | "">("");
  const [mechanicId, setMechanicId] = useState("");
  const [relation, setRelation] = useState<Agency>("cause");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [voting, setVoting] = useState<string | null>(null);

  async function reload() {
    const { marks: list, error } = await listMarksForOracle(oracleId);
    if (error) setStatus(error);
    else setMarks(list);
  }

  useEffect(() => {
    void reload();
  }, [oracleId]);

  useEffect(() => {
    if (!user) return;
    void isCurrentUserAdmin(user.id).then(setAdmin);
  }, [user]);

  const subs = useMemo(
    () => (family ? MECHANICS.filter((m) => m.family === family) : []),
    [family]
  );
  const selected = mechanicId ? mechanicById(mechanicId) : undefined;

  async function submit() {
    if (!user || !selected) {
      setStatus("Sign in to mark cards.");
      return;
    }
    setBusy(true);
    const { error } = await proposeMark(user.id, {
      oracle_id: oracleId,
      mechanic_id: selected.id,
      ...storedRelation(relation),
    });
    setBusy(false);
    setStatus(error ?? `Proposed ${selected.name}.`);
    if (!error) void reload();
  }

  async function vote(markId: string, kind: "endorse" | "flag") {
    if (!user || voting) return;
    setVoting(markId);
    const { error } = await voteMark(user.id, markId, kind);
    setVoting(null);
    if (error) setStatus(error);
    else void reload();
  }

  return (
    <div className={styles.wrap}>
      <section className={styles.marks}>
        <div className={styles.sectionHead}>
          <h3>On this card</h3>
          <span>{marks.length}</span>
        </div>
        {marks.length === 0 ? (
          <p className={styles.empty}>No marks yet. Propose how this card uses a mechanic.</p>
        ) : (
          <ul className={styles.markList}>
            {marks.map((m) => {
              const def = mechanicById(m.mechanic_id);
              return (
                <li key={m.id} className={styles.mark}>
                  <div className={styles.markTop}>
                    <strong>{def?.name ?? m.mechanic_id}</strong>
                    <span className={styles.status} data-status={m.status}>
                      {STATUS_LABEL[m.status]}
                    </span>
                  </div>
                  <p className={styles.role}>{AGENCY_LABEL[m.agency]}</p>
                  {def?.hint ? <p className={styles.markHint}>{def.hint}</p> : null}
                  {(user && m.status !== "locked") || admin ? (
                    <div className={styles.markActions}>
                      {user && m.status !== "locked" ? (
                        <>
                          <button
                            type="button"
                            disabled={voting === m.id}
                            onClick={() => void vote(m.id, "endorse")}
                          >
                            Endorse {m.endorse_count}
                          </button>
                          <button
                            type="button"
                            disabled={voting === m.id}
                            onClick={() => void vote(m.id, "flag")}
                          >
                            Flag {m.flag_count}
                          </button>
                        </>
                      ) : null}
                      {admin ? (
                        <button
                          type="button"
                          className={styles.lock}
                          onClick={() =>
                            void lockMark(user!.id, m.id, m.status !== "locked").then(() => reload())
                          }
                        >
                          {m.status === "locked" ? "Unlock" : "Lock"}
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className={styles.compose}>
        <div className={styles.sectionHead}>
          <h3>Propose</h3>
        </div>
        <p className={styles.lead}>Pick a category, then the mechanic.</p>
        <ThemeSelect
          label="Category"
          placeholder="Choose a category"
          value={family}
          options={MECHANIC_FAMILIES.map((f) => ({ id: f.id, label: f.label }))}
          onChange={(id) => {
            setFamily(id as MechanicFamily);
            setMechanicId("");
          }}
        />
        <ThemeSelect
          label="Mechanic"
          placeholder={family ? "Choose a mechanic" : "Choose a category first"}
          value={mechanicId}
          disabled={!family}
          options={subs.map((m) => ({ id: m.id, label: m.name, hint: m.hint }))}
          onChange={setMechanicId}
        />

        {selected ? (
          <p className={styles.preview}>
            <strong>{selected.name}</strong>
            <span>{AGENCY_LABEL[relation]}</span>
          </p>
        ) : null}

        <div className={styles.axis}>
          <div className={styles.axisLabel}>
            <span>Relationship</span>
          </div>
          <div className={styles.seg} role="group" aria-label="Relationship">
            {AGENCY.map((id) => (
              <button
                key={id}
                type="button"
                className={relation === id ? styles.segOn : undefined}
                aria-pressed={relation === id}
                onClick={() => setRelation(id)}
              >
                {AGENCY_LABEL[id]}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          className={styles.submit}
          disabled={busy || !user || !selected}
          onClick={() => void submit()}
        >
          {busy ? "Proposing…" : selected ? `Propose ${selected.name}` : "Propose"}
        </button>
        {!user ? <p className={styles.hint}>Sign in to propose or vote.</p> : null}
        {status ? <p className={styles.hint}>{status}</p> : null}
      </section>
    </div>
  );
}
