import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { ensureUserCardFromScryfall, setUsefulInTags } from "../services/userCardService";
import { usefulInSummary, type UsefulInTag } from "../lib/cards/usefulIn";
import type { ScryfallCard } from "../types/scryfallCard";
import styles from "./UsefulInPicker.module.css";

const COLORS = ["W", "U", "B", "R", "G"] as const;

type Props = {
  oracleId: string;
  /** Optional Scryfall card so we can ensure user_cards exists before save. */
  scryfallCard?: ScryfallCard | null;
  value?: string[];
  onChange?: (tags: string[]) => void;
};

/**
 * "Useful in" tags — additive filter for drawers, not a color-identity override.
 */
export function UsefulInPicker({
  oracleId,
  scryfallCard,
  value = [],
  onChange,
}: Props) {
  const { user } = useAuth();
  const [tags, setTags] = useState<Set<string>>(
    () => new Set(value.map((t) => t.toUpperCase() === t && t.length === 1 ? t : t.toLowerCase()))
  );
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    const next = new Set<string>();
    for (const t of value) {
      const up = t.toUpperCase();
      if (["W", "U", "B", "R", "G"].includes(up)) next.add(up);
      else next.add(t.toLowerCase());
    }
    setTags(next);
  }, [oracleId, value]);

  const hasMode =
    tags.has("colorless") ||
    tags.has("colored") ||
    tags.has("mono") ||
    tags.has("multi") ||
    tags.has("wubrg");
  const colorCount = COLORS.filter((c) => tags.has(c)).length;
  // Mono only makes sense with 0–1 colors selected
  const monoAllowed = colorCount <= 1;

  const summary = useMemo(
    () => usefulInSummary([...tags]),
    [tags]
  );

  if (!user) return null;

  function exclusiveMode(
    mode: "colorless" | "colored" | "mono" | "multi" | "wubrg"
  ) {
    setStatus(null);
    setTags((prev) => {
      const next = new Set<string>();
      if (mode === "mono" || mode === "multi" || mode === "colored") {
        for (const c of COLORS) {
          if (prev.has(c)) next.add(c);
        }
        if (mode === "mono") {
          const first = COLORS.find((c) => next.has(c));
          next.clear();
          if (first) next.add(first);
        }
        if (mode === "colored" && prev.has("multi")) next.add("multi");
        if (mode === "multi" && prev.has("colored")) next.add("colored");
      }
      next.add(mode);
      return next;
    });
  }

  function toggleColor(c: string) {
    setStatus(null);
    setTags((prev) => {
      const next = new Set(prev);
      // Colors incompatible with pure colorless / wubrg modes
      next.delete("colorless");
      next.delete("wubrg");
      if (next.has("colorless")) next.delete("colorless");
      if (next.has(c)) next.delete(c);
      else {
        if (next.has("mono")) {
          // Mono: only one color
          for (const x of COLORS) next.delete(x);
          next.add(c);
        } else {
          next.add(c);
        }
      }
      return next;
    });
  }

  function clearMode(mode: string) {
    setTags((prev) => {
      const next = new Set(prev);
      next.delete(mode);
      return next;
    });
  }

  function onModeClick(
    mode: "colorless" | "colored" | "mono" | "multi" | "wubrg"
  ) {
    if (tags.has(mode)) {
      clearMode(mode);
      setStatus(null);
      return;
    }
    if (mode === "mono" && !monoAllowed && colorCount > 1) {
      setStatus("Mono requires at most one color — deselect extra colors first.");
      return;
    }
    exclusiveMode(mode);
  }

  async function save() {
    if (!user) return;
    setBusy(true);
    setStatus(null);
    if (scryfallCard) {
      await ensureUserCardFromScryfall(user.id, scryfallCard);
    }
    const list = [...tags];
    const { error } = await setUsefulInTags(user.id, oracleId, list);
    setBusy(false);
    if (error) {
      setStatus(error);
      return;
    }
    setStatus(list.length ? summary : "Cleared — useful in any deck");
    onChange?.(list);
  }

  async function clear() {
    setTags(new Set());
    setBusy(true);
    if (scryfallCard) {
      await ensureUserCardFromScryfall(user!.id, scryfallCard);
    }
    const { error } = await setUsefulInTags(user!.id, oracleId, []);
    setBusy(false);
    if (error) {
      setStatus(error);
      return;
    }
    setStatus("Cleared — useful in any deck");
    onChange?.([]);
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.label}>
        Useful in
        <span className={styles.hint}>
          Extra drawer filter — does not change printed color identity
        </span>
      </div>

      <div className={styles.tags} role="group" aria-label="Useful in">
        <div className={styles.tagRow}>
          {(
            [
              ["colorless", "Colorless"],
              ["colored", "Colored"],
              ["mono", "Mono"],
              ["multi", "Multi"],
              ["wubrg", "WUBRG"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`${styles.tag}${tags.has(id) ? ` ${styles.tagOn}` : ""}${
                id === "mono" && !monoAllowed ? ` ${styles.tagDisabled}` : ""
              }`}
              onClick={() => onModeClick(id)}
              disabled={id === "mono" && !monoAllowed && !tags.has("mono")}
              title={
                id === "mono" && !monoAllowed
                  ? "Select only one color for Mono"
                  : undefined
              }
            >
              {label}
            </button>
          ))}
        </div>
        <div className={styles.tagRow}>
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              className={`${styles.tag} ${styles[`pip${c}`]}${
                tags.has(c) ? ` ${styles.tagOn}` : ""
              }`}
              onClick={() => toggleColor(c)}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <p className={styles.previewLine}>{summary}</p>

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
          Clear
        </button>
      </div>
      {status && <p className={styles.status}>{status}</p>}
    </div>
  );
}
