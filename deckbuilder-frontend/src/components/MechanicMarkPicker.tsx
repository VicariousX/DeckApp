import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import {
  AGENCY,
  AGENCY_LABEL,
  ECONOMY,
  ECONOMY_LABEL,
  FLOW,
  FLOW_LABEL,
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

const AXES: {
  id: string;
  caption: string;
  value: "economy" | "flow" | "agency";
}[] = [
  { id: "Economy", caption: "Makes the mechanic, or pays it off.", value: "economy" },
  { id: "Flow", caption: "Feeds the engine, or spends it.", value: "flow" },
  { id: "Agency", caption: "Causes the effect, or benefits from it.", value: "agency" },
];

export function MechanicMarkPicker({ oracleId }: Props) {
  const { user } = useAuth();
  const [marks, setMarks] = useState<MechanicMark[]>([]);
  const [admin, setAdmin] = useState(false);
  const [family, setFamily] = useState(MECHANIC_FAMILIES[0].id);
  const [mechanicId, setMechanicId] = useState(
    MECHANICS.find((m) => m.family === MECHANIC_FAMILIES[0].id)?.id ?? "tokens"
  );
  const [economy, setEconomy] = useState<Economy>("producer");
  const [flow, setFlow] = useState<Flow>("feed");
  const [agency, setAgency] = useState<Agency>("cause");
  const [q, setQ] = useState("");
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

  const pool = useMemo(() => {
    const s = q.trim().toLowerCase();
    return MECHANICS.filter((m) => {
      if (!s) return m.family === family;
      return (
        m.name.toLowerCase().includes(s) ||
        m.id.includes(s) ||
        m.hint.toLowerCase().includes(s)
      );
    });
  }, [family, q]);

  const selected = mechanicById(mechanicId) ?? pool[0];
  const familyLabel = (id: MechanicFamily) =>
    MECHANIC_FAMILIES.find((f) => f.id === id)?.label ?? id;

  function chooseMechanic(id: string, nextFamily?: MechanicFamily) {
    setMechanicId(id);
    if (nextFamily) setFamily(nextFamily);
  }

  async function submit() {
    if (!user || !selected) {
      setStatus("Sign in to mark cards.");
      return;
    }
    setBusy(true);
    const { error } = await proposeMark(user.id, {
      oracle_id: oracleId,
      mechanic_id: selected.id,
      economy,
      flow,
      agency,
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
                  <p className={styles.role}>
                    {ECONOMY_LABEL[m.economy]} · {FLOW_LABEL[m.flow]} · {AGENCY_LABEL[m.agency]}
                  </p>
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
        <p className={styles.lead}>
          Marks tell the synergy map whether this card makes a mechanic or pays it off.
        </p>
        <input
          className={styles.search}
          value={q}
          placeholder="Search mechanics"
          aria-label="Search mechanics"
          onChange={(e) => setQ(e.target.value)}
        />
        {!q ? (
          <div className={styles.familyRail} role="tablist" aria-label="Mechanic families">
            {MECHANIC_FAMILIES.map((f) => (
              <button
                key={f.id}
                type="button"
                role="tab"
                aria-selected={family === f.id}
                className={family === f.id ? styles.familyOn : styles.family}
                onClick={() => {
                  setFamily(f.id);
                  const first = MECHANICS.find((m) => m.family === f.id);
                  if (first) setMechanicId(first.id);
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
        ) : (
          <p className={styles.count}>
            {pool.length} match{pool.length === 1 ? "" : "es"}
          </p>
        )}
        <div className={styles.mechList} role="listbox" aria-label="Mechanics">
          {pool.length === 0 ? (
            <p className={styles.empty}>No mechanic matches that.</p>
          ) : (
            pool.map((m) => (
              <button
                key={m.id}
                type="button"
                role="option"
                aria-selected={selected?.id === m.id}
                className={selected?.id === m.id ? styles.mechOn : styles.mech}
                onClick={() => chooseMechanic(m.id, q ? m.family : undefined)}
              >
                <span>{m.name}</span>
                <small>{q ? familyLabel(m.family) : m.hint}</small>
              </button>
            ))
          )}
        </div>

        {selected ? (
          <p className={styles.preview}>
            <strong>{selected.name}</strong>
            <span>
              {ECONOMY_LABEL[economy]} · {FLOW_LABEL[flow]} · {AGENCY_LABEL[agency]}
            </span>
          </p>
        ) : null}

        <div className={styles.axes}>
          {AXES.map((axis) => {
            const current = axis.value === "economy" ? economy : axis.value === "flow" ? flow : agency;
            const options =
              axis.value === "economy"
                ? ECONOMY.map((v) => ({ id: v, label: ECONOMY_LABEL[v] }))
                : axis.value === "flow"
                  ? FLOW.map((v) => ({ id: v, label: FLOW_LABEL[v] }))
                  : AGENCY.map((v) => ({ id: v, label: AGENCY_LABEL[v] }));
            return (
              <div key={axis.value} className={styles.axis}>
                <div className={styles.axisLabel}>
                  <span>{axis.id}</span>
                  <small>{axis.caption}</small>
                </div>
                <div className={styles.seg} role="group" aria-label={axis.id}>
                  {options.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      className={current === opt.id ? styles.segOn : undefined}
                      aria-pressed={current === opt.id}
                      onClick={() => {
                        if (axis.value === "economy") setEconomy(opt.id as Economy);
                        else if (axis.value === "flow") setFlow(opt.id as Flow);
                        else setAgency(opt.id as Agency);
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
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
