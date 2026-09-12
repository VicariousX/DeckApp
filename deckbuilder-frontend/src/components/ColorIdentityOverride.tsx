import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { setImposedColorIdentity } from "../services/userCardService";
import styles from "./ColorIdentityOverride.module.css";

const COLORS = ["W", "U", "B", "R", "G"] as const;

type Props = {
  oracleId: string;
  /** Printed identity from Scryfall / user_cards */
  printedIdentity?: string[];
  /** Current imposed override */
  imposedIdentity?: string[] | null;
  onChange?: (imposed: string[] | null) => void;
};

/**
 * Let users assign a color identity override for drawer filtering
 * (e.g. Yavimaya → G) without changing the printed card data.
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
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    setSelected(new Set((imposedIdentity ?? []).map((c) => c.toUpperCase())));
  }, [oracleId, imposedIdentity]);

  if (!user) return null;

  function toggle(c: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });
    setStatus(null);
  }

  async function save() {
    setBusy(true);
    setStatus(null);
    const arr = COLORS.filter((c) => selected.has(c));
    const value = arr.length > 0 ? [...arr] : null;
    const { error } = await setImposedColorIdentity(user!.id, oracleId, value);
    setBusy(false);
    if (error) {
      setStatus(error);
      return;
    }
    setStatus(value ? `Override: ${value.join("")}` : "Using printed identity");
    onChange?.(value);
  }

  async function clear() {
    setSelected(new Set());
    setBusy(true);
    const { error } = await setImposedColorIdentity(user!.id, oracleId, null);
    setBusy(false);
    if (error) {
      setStatus(error);
      return;
    }
    setStatus("Using printed identity");
    onChange?.(null);
  }

  const printed =
    printedIdentity.length > 0 ? printedIdentity.join("") : "Colorless";

  return (
    <div className={styles.wrap}>
      <div className={styles.label}>
        Color identity override
        <span className={styles.hint}>Printed: {printed}</span>
      </div>
      <div className={styles.pips} role="group" aria-label="Imposed color identity">
        {COLORS.map((c) => (
          <button
            key={c}
            type="button"
            className={`${styles.pip} ${styles[`pip${c}`]}${
              selected.has(c) ? ` ${styles.pipOn}` : ""
            }`}
            aria-pressed={selected.has(c)}
            onClick={() => toggle(c)}
          >
            {c}
          </button>
        ))}
      </div>
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
