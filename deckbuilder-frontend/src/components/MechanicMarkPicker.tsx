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
} from "../lib/mechanics/catalog";
import {
  isCurrentUserAdmin,
  listMarksForOracle,
  lockMark,
  proposeMark,
  voteMark,
  type MechanicMark,
} from "../services/mechanicMarkService";
import styles from "./MechanicMarkPicker.module.css";

type Props = { oracleId: string };

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
      if (s) return m.name.toLowerCase().includes(s) || m.id.includes(s);
      return m.family === family;
    });
  }, [family, q]);

  async function submit() {
    if (!user) {
      setStatus("Log in to mark cards");
      return;
    }
    setBusy(true);
    const { error } = await proposeMark(user.id, {
      oracle_id: oracleId,
      mechanic_id: mechanicId,
      economy,
      flow,
      agency,
    });
    setBusy(false);
    setStatus(error ?? "Proposed — others can endorse");
    if (!error) void reload();
  }

  return (
    <div className={styles.wrap}>
      <p className={styles.lead}>
        Community marks teach the synergy map how this card feeds or pays off a
        mechanic. Proposed marks need endorsements; flagged marks wait for an
        admin lock.
      </p>
      {marks.length > 0 && (
        <ul className={styles.list}>
          {marks.map((m) => {
            const def = mechanicById(m.mechanic_id);
            return (
              <li key={m.id} className={styles.row}>
                <div>
                  <strong>{def?.name ?? m.mechanic_id}</strong>
                  <span>
                    {ECONOMY_LABEL[m.economy]} · {FLOW_LABEL[m.flow]} ·{" "}
                    {AGENCY_LABEL[m.agency]}
                  </span>
                  <em>{m.status}</em>
                </div>
                {user && m.status !== "locked" && (
                  <div className={styles.votes}>
                    <button
                      type="button"
                      onClick={() => void voteMark(user.id, m.id, "endorse").then(reload)}
                    >
                      Endorse {m.endorse_count}
                    </button>
                    <button
                      type="button"
                      onClick={() => void voteMark(user.id, m.id, "flag").then(reload)}
                    >
                      Flag {m.flag_count}
                    </button>
                  </div>
                )}
                {admin && (
                  <button
                    type="button"
                    className={styles.lock}
                    onClick={() =>
                      void lockMark(user!.id, m.id, m.status !== "locked").then(reload)
                    }
                  >
                    {m.status === "locked" ? "Unlock" : "Lock"}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <div className={styles.compose}>
        <input
          className={styles.search}
          value={q}
          placeholder="Find a mechanic…"
          onChange={(e) => setQ(e.target.value)}
        />
        {!q && (
          <div className={styles.fams}>
            {MECHANIC_FAMILIES.map((f) => (
              <button
                key={f.id}
                type="button"
                className={family === f.id ? styles.chipOn : styles.chip}
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
        )}
        <div className={styles.fams}>
          {pool.slice(0, 24).map((m) => (
            <button
              key={m.id}
              type="button"
              className={mechanicId === m.id ? styles.chipOn : styles.chip}
              title={m.hint}
              onClick={() => setMechanicId(m.id)}
            >
              {m.name}
            </button>
          ))}
        </div>
        <div className={styles.axes}>
          <span>Economy</span>
          {ECONOMY.map((v) => (
            <button
              key={v}
              type="button"
              className={economy === v ? styles.chipOn : styles.chip}
              onClick={() => setEconomy(v)}
            >
              {ECONOMY_LABEL[v]}
            </button>
          ))}
        </div>
        <div className={styles.axes}>
          <span>Flow</span>
          {FLOW.map((v) => (
            <button
              key={v}
              type="button"
              className={flow === v ? styles.chipOn : styles.chip}
              onClick={() => setFlow(v)}
            >
              {FLOW_LABEL[v]}
            </button>
          ))}
        </div>
        <div className={styles.axes}>
          <span>Agency</span>
          {AGENCY.map((v) => (
            <button
              key={v}
              type="button"
              className={agency === v ? styles.chipOn : styles.chip}
              onClick={() => setAgency(v)}
            >
              {AGENCY_LABEL[v]}
            </button>
          ))}
        </div>
        <button
          type="button"
          className={styles.submit}
          disabled={busy || !user}
          onClick={() => void submit()}
        >
          Propose mark
        </button>
        {status && <p className={styles.hint}>{status}</p>}
      </div>
    </div>
  );
}
