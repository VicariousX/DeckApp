import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { setImposedColorIdentity } from "../services/userCardService";
import styles from "./ColorIdentityOverride.module.css";

const COLORS = ["W", "U", "B", "R", "G"] as const;

type Props = {
  oracleId: string;
  printedIdentity?: string[];
  imposedIdentity?: string[] | null;
  onChange?: (imposed: string[] | null) => void;
};

/**
 * User-imposed color identity for drawer filters.
 * null = use printed; [] = force colorless; 1 color = mono; 2+ = multi.
 */
export function ColorIdentityOverride({
  oracleId,
  printedIdentity = [],
  imposedIdentity = null,
  onChange,
}: Props) {
  const { user } = useAuth();
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set((imposedIdentity ?? []).map((c) => c.toUpperCase()))
  );
  const [forceColorless, setForceColorless] = useState(
    () => imposedIdentity !== null && imposedIdentity.length === 0
  );
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    const imp = imposedIdentity;
    if (imp === null) {
      setSelected(new Set());
      setForceColorless(false);
    } else if (imp.length === 0) {
      setSelected(new Set());
      setForceColorless(true);
    } else {
      setSelected(new Set(imp.map((c) => c.toUpperCase())));
      setForceColorless(false);
    }
  }, [oracleId, imposedIdentity]);

  if (!user) return null;

  function toggle(c: string) {
    setForceColorless(false);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });
    setStatus(null);
  }

  function setMono(c: string) {
    setForceColorless(false);
    setSelected(new Set([c]));
    setStatus(null);
  }

  function setColorless() {
    setForceColorless(true);
    setSelected(new Set());
    setStatus(null);
  }

  async function persist(value: string[] | null, label: string) {
    setBusy(true);
    setStatus(null);
    const { error } = await setImposedColorIdentity(user!.id, oracleId, value);
    setBusy(false);
    if (error) {
      setStatus(error);
      return;
    }
    setStatus(label);
    onChange?.(value);
  }

  async function save() {
    if (forceColorless) {
      await persist([], "Override: Colorless");
      return;
    }
    const arr = COLORS.filter((c) => selected.has(c));
    if (arr.length === 0) {
      await persist(null, "Using printed identity");
      return;
    }
    const kind = arr.length === 1 ? "Mono" : "Multi";
    await persist([...arr], `Override: ${kind} ${arr.join("")}`);
  }

  async function clear() {
    setSelected(new Set());
    setForceColorless(false);
    await persist(null, "Using printed identity");
  }

  const printed =
    printedIdentity.length > 0 ? printedIdentity.join("") : "Colorless";
  const preview =
    forceColorless
      ? "Colorless"
      : selected.size === 0
        ? "Printed"
        : selected.size === 1
          ? `Mono ${[...selected].join("")}`
          : `Multi ${COLORS.filter((c) => selected.has(c)).join("")}`;

  return (
    <div className={styles.wrap}>
      <div className={styles.label}>
        Color identity override
        <span className={styles.hint}>Printed: {printed}</span>
      </div>
      <div className={styles.quickRow}>
        <button
          type="button"
          className={`${styles.quickBtn}${forceColorless ? ` ${styles.quickOn}` : ""}`}
          onClick={setColorless}
        >
          Colorless
        </button>
        {COLORS.map((c) => (
          <button
            key={`mono-${c}`}
            type="button"
            className={`${styles.quickBtn} ${styles[`pip${c}`]}`}
            onClick={() => setMono(c)}
            title={`Mono ${c}`}
          >
            Mono {c}
          </button>
        ))}
      </div>
      <div className={styles.pips} role="group" aria-label="Imposed color identity">
        {COLORS.map((c) => (
          <button
            key={c}
            type="button"
            className={`${styles.pip} ${styles[`pip${c}`]}${
              selected.has(c) && !forceColorless ? ` ${styles.pipOn}` : ""
            }`}
            aria-pressed={selected.has(c) && !forceColorless}
            onClick={() => toggle(c)}
          >
            {c}
          </button>
        ))}
      </div>
      <p className={styles.previewLine}>
        Will save as: <strong>{preview}</strong>
        {selected.size >= 2 ? " (multicolor)" : ""}
      </p>
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.saveBtn}
          disabled={busy}
          onClick={() => void save()}
        >
          Save override
        </button>
        <button
          type="button"
          className={styles.clearBtn}
          disabled={busy}
          onClick={() => void clear()}
        >
          Clear
        </button>
      </div>
      {status && <p className={styles.status}>{status}</p>}
    </div>
  );
}
