import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { setImposedColorIdentity } from "../services/userCardService";
import styles from "./ColorIdentityOverride.module.css";

const COLORS = ["W", "U", "B", "R", "G"] as const;
type Color = (typeof COLORS)[number];
type Mode = "printed" | "colorless" | "mono" | "multi";

type Props = {
  oracleId: string;
  printedIdentity?: string[];
  imposedIdentity?: string[] | null;
  onChange?: (imposed: string[] | null) => void;
};

function modeFromImposed(imposed: string[] | null | undefined): Mode {
  if (imposed === null || imposed === undefined) return "printed";
  if (imposed.length === 0) return "colorless";
  if (imposed.length === 1) return "mono";
  return "multi";
}

/**
 * Identity override using tags: W U B R G · Colorless · Mono · Multi.
 * Combinations: Mono+G, Multi+G+U, Colorless, or clear back to printed.
 */
export function ColorIdentityOverride({
  oracleId,
  printedIdentity = [],
  imposedIdentity = null,
  onChange,
}: Props) {
  const { user } = useAuth();
  const [mode, setMode] = useState<Mode>(() => modeFromImposed(imposedIdentity));
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set((imposedIdentity ?? []).map((c) => c.toUpperCase()))
  );
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    setMode(modeFromImposed(imposedIdentity));
    setSelected(new Set((imposedIdentity ?? []).map((c) => c.toUpperCase())));
  }, [oracleId, imposedIdentity]);

  const summary = useMemo(() => {
    if (mode === "printed") return "Printed identity";
    if (mode === "colorless") return "Colorless";
    const cols = COLORS.filter((c) => selected.has(c));
    if (mode === "mono") {
      return cols[0] ? `Mono ${cols[0]}` : "Mono (pick a color)";
    }
    if (cols.length < 2) return "Multi (pick 2+ colors)";
    return `Multi ${cols.join("")}`;
  }, [mode, selected]);

  if (!user) return null;

  function pickMode(next: Mode) {
    setStatus(null);
    if (next === "colorless") {
      setMode("colorless");
      setSelected(new Set());
      return;
    }
    if (next === "mono") {
      setMode("mono");
      // Keep at most one color
      const first = COLORS.find((c) => selected.has(c));
      setSelected(first ? new Set([first]) : new Set());
      return;
    }
    if (next === "multi") {
      setMode("multi");
      return;
    }
    setMode("printed");
    setSelected(new Set());
  }

  function toggleColor(c: Color) {
    setStatus(null);
    if (mode === "colorless" || mode === "printed") {
      setMode("mono");
      setSelected(new Set([c]));
      return;
    }
    if (mode === "mono") {
      setSelected(new Set([c]));
      return;
    }
    // multi
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });
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
    if (mode === "printed") {
      await persist(null, "Using printed identity");
      return;
    }
    if (mode === "colorless") {
      await persist([], "Override: Colorless");
      return;
    }
    const cols = COLORS.filter((c) => selected.has(c));
    if (mode === "mono") {
      if (cols.length !== 1) {
        setStatus("Mono requires exactly one color.");
        return;
      }
      await persist([cols[0]], `Override: Mono ${cols[0]}`);
      return;
    }
    if (cols.length < 2) {
      setStatus("Multi requires at least two colors.");
      return;
    }
    await persist(cols, `Override: Multi ${cols.join("")}`);
  }

  async function clear() {
    setMode("printed");
    setSelected(new Set());
    await persist(null, "Using printed identity");
  }

  const printed =
    printedIdentity.length > 0 ? printedIdentity.join("") : "Colorless";

  return (
    <div className={styles.wrap}>
      <div className={styles.label}>
        Identity override
        <span className={styles.hint}>Printed: {printed}</span>
      </div>

      <div className={styles.tags} role="group" aria-label="Identity mode">
        <button
          type="button"
          className={`${styles.tag}${mode === "colorless" ? ` ${styles.tagOn}` : ""}`}
          onClick={() => pickMode("colorless")}
        >
          Colorless
        </button>
        <button
          type="button"
          className={`${styles.tag}${mode === "mono" ? ` ${styles.tagOn}` : ""}`}
          onClick={() => pickMode("mono")}
        >
          Mono
        </button>
        <button
          type="button"
          className={`${styles.tag}${mode === "multi" ? ` ${styles.tagOn}` : ""}`}
          onClick={() => pickMode("multi")}
        >
          Multi
        </button>
        {COLORS.map((c) => (
          <button
            key={c}
            type="button"
            className={`${styles.tag} ${styles[`pip${c}`]}${
              selected.has(c) && mode !== "colorless" && mode !== "printed"
                ? ` ${styles.tagOn}`
                : ""
            }`}
            aria-pressed={selected.has(c)}
            onClick={() => toggleColor(c)}
          >
            {c}
          </button>
        ))}
      </div>

      <p className={styles.previewLine}>
        {summary}
      </p>

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.saveBtn}
          disabled={busy}
          onClick={() => void save()}
        >
          Save
        </button>
        <button
          type="button"
          className={styles.clearBtn}
          disabled={busy}
          onClick={() => void clear()}
        >
          Use printed
        </button>
      </div>
      {status && <p className={styles.status}>{status}</p>}
    </div>
  );
}
