import { useMemo, useState } from "react";
import {
  mergeParsedEntries,
  parseCardList,
  type ParsedCardLine,
} from "../lib/cards/parseCardList";
import { fetchCardsByNames } from "../lib/scryfallApi";
import type { ScryfallCard } from "../types/scryfallCard";
import styles from "./BulkCardImport.module.css";

export type BulkResolvedEntry = {
  name: string;
  quantity: number;
  card: ScryfallCard;
};

type Props = {
  /** Called with successfully resolved cards after user confirms import */
  onImport: (entries: BulkResolvedEntry[]) => Promise<void> | void;
  /** When false, quantity is forced to 1 (drawer membership). Default true. */
  respectQuantity?: boolean;
  title?: string;
  placeholder?: string;
};

export function BulkCardImport({
  onImport,
  respectQuantity = true,
  title = "Bulk import",
  placeholder = "Paste a list…\n1 Sol Ring\n1x Arcane Signet\nCultivate",
}: Props) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState<string[]>([]);
  const [preview, setPreview] = useState<BulkResolvedEntry[] | null>(null);
  const [progress, setProgress] = useState<string | null>(null);

  const parsed = useMemo(() => {
    const { entries, skipped } = parseCardList(text);
    return { entries: mergeParsedEntries(entries), skipped };
  }, [text]);

  async function resolve() {
    setError(null);
    setNotFound([]);
    setPreview(null);
    const entries = parsed.entries;
    if (entries.length === 0) {
      setError("No card lines found.");
      return;
    }
    setBusy(true);
    setProgress(`Looking up ${entries.length} cards…`);
    const { byName, notFound: nf, error: err } = await fetchCardsByNames(
      entries.map((e) => e.name)
    );
    setBusy(false);
    setProgress(null);
    if (err && byName.size === 0) {
      setError(err);
      return;
    }
    const resolved: BulkResolvedEntry[] = [];
    const missing: string[] = [...nf];
    for (const e of entries) {
      const card = byName.get(e.name.toLowerCase());
      if (!card) {
        if (!missing.includes(e.name)) missing.push(e.name);
        continue;
      }
      resolved.push({
        name: card.name,
        quantity: respectQuantity ? e.quantity : 1,
        card,
      });
    }
    setNotFound(missing);
    setPreview(resolved);
    if (resolved.length === 0) {
      setError("None of the names could be resolved.");
    }
  }

  async function confirmImport() {
    if (!preview?.length) return;
    setBusy(true);
    setError(null);
    setProgress(`Importing ${preview.length} cards…`);
    try {
      await onImport(preview);
      setText("");
      setPreview(null);
      setNotFound([]);
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed.");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  return (
    <div className={styles.wrap}>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {open ? "Close import" : title}
      </button>

      {open && (
        <div className={styles.panel}>
          <p className={styles.hint}>
            One card per line. Supports <code>1x Name</code>, <code>1 Name</code>,
            and plain names. Set codes in parentheses are ignored.
          </p>
          <textarea
            className={styles.textarea}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setPreview(null);
              setNotFound([]);
            }}
            placeholder={placeholder}
            rows={8}
            disabled={busy}
          />
          <div className={styles.meta}>
            <span>
              {parsed.entries.length} unique name
              {parsed.entries.length === 1 ? "" : "s"}
              {respectQuantity
                ? ` · ${parsed.entries.reduce((n, e) => n + e.quantity, 0)} copies`
                : ""}
            </span>
            {parsed.skipped.length > 0 && (
              <span className={styles.skipped}>
                {parsed.skipped.length} line
                {parsed.skipped.length === 1 ? "" : "s"} skipped
              </span>
            )}
          </div>

          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
          {progress && <p className={styles.progress}>{progress}</p>}

          {preview && (
            <div className={styles.preview}>
              <p className={styles.previewTitle}>
                Ready to import {preview.length} card
                {preview.length === 1 ? "" : "s"}
              </p>
              <ul className={styles.previewList}>
                {preview.slice(0, 12).map((e) => (
                  <li key={e.card.id}>
                    {respectQuantity && e.quantity > 1
                      ? `${e.quantity}× `
                      : ""}
                    {e.name}
                  </li>
                ))}
                {preview.length > 12 && (
                  <li className={styles.more}>
                    +{preview.length - 12} more
                  </li>
                )}
              </ul>
              {notFound.length > 0 && (
                <div className={styles.notFound}>
                  <p className={styles.notFoundTitle}>
                    Not found ({notFound.length})
                  </p>
                  <p className={styles.notFoundNames}>
                    {notFound.slice(0, 8).join(", ")}
                    {notFound.length > 8
                      ? ` +${notFound.length - 8} more`
                      : ""}
                  </p>
                </div>
              )}
            </div>
          )}

          <div className={styles.actions}>
            {!preview ? (
              <button
                type="button"
                className={styles.primaryBtn}
                disabled={busy || parsed.entries.length === 0}
                onClick={() => void resolve()}
              >
                {busy ? "Looking up…" : "Preview"}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className={styles.ghostBtn}
                  disabled={busy}
                  onClick={() => setPreview(null)}
                >
                  Back
                </button>
                <button
                  type="button"
                  className={styles.primaryBtn}
                  disabled={busy || preview.length === 0}
                  onClick={() => void confirmImport()}
                >
                  {busy ? "Importing…" : `Import ${preview.length}`}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Re-export type for callers that only need the parse shape
export type { ParsedCardLine };
