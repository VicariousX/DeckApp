import { createPortal } from "react-dom";
import { useMemo, useState } from "react";
import { useDraggablePanel } from "../hooks/useDraggablePanel";
import {
  mergeParsedEntries,
  parseCardList,
  type ParsedCardLine,
} from "../lib/cards/parseCardList";
import { namesFromTtsJson } from "../lib/cards/ttsDeck";
import { fetchCardsByNames } from "../lib/scryfallApi";
import { apiUrl } from "../lib/apiBase";
import type { ScryfallCard } from "../types/scryfallCard";
import styles from "./BulkCardImport.module.css";

export type BulkResolvedEntry = {
  name: string;
  quantity: number;
  card: ScryfallCard;
  board?: "main" | "side" | "maybe" | "commander";
};

type Props = {
  /** Called with successfully resolved cards after user confirms import */
  onImport: (entries: BulkResolvedEntry[]) => Promise<void> | void;
  /** When false, quantity is forced to 1 (drawer membership). Default true. */
  respectQuantity?: boolean;
  title?: string;
  placeholder?: string;
  /** Oracle ids already present — used with missing-only. */
  existingOracleIds?: string[];
  triggerClassName?: string;
};

export function BulkCardImport({
  onImport,
  respectQuantity = true,
  title = "Bulk Import",
  placeholder = "Paste a list…\n1 Sol Ring\n1x Arcane Signet\nCultivate",
  existingOracleIds,
  triggerClassName,
}: Props) {
  const [open, setOpen] = useState(false);
  const [missingOnly, setMissingOnly] = useState(false);
  const { panelRef, anchorRef, panelStyle, onHandlePointerDown, onResizePointerDown } = useDraggablePanel(open, { w: 400, h: 440 });
  const [text, setText] = useState("");
  const [link, setLink] = useState("");
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
      const oid = (card.oracle_id ?? "").toLowerCase();
      if (
        missingOnly &&
        existingOracleIds?.some((id) => id.toLowerCase() === oid)
      ) {
        continue;
      }
      resolved.push({
        name: card.name,
        quantity: respectQuantity ? e.quantity : 1,
        card,
        board: e.board,
      });
    }
    setNotFound(missing);
    setPreview(resolved);
    if (resolved.length === 0) {
      setError("None of the names could be resolved.");
    }
  }

  async function fetchLink() {
    const url = link.trim();
    if (!url) return;
    setBusy(true);
    setError(null);
    setPreview(null);
    setProgress("Fetching deck link…");
    try {
      const res = await fetch(apiUrl(`/api/import/deck?url=${encodeURIComponent(url)}`));
      const data = (await res.json()) as {
        error?: string;
        name?: string;
        cards?: { name: string; quantity: number; board: string }[];
      };
      if (!res.ok || !data.cards) {
        setError(data.error || "Could not read that link.");
        return;
      }
      const blocks: Record<string, string[]> = {
        commander: [],
        main: [],
        side: [],
        maybe: [],
      };
      for (const card of data.cards) {
        const board = blocks[card.board] ? card.board : "main";
        blocks[board].push(`${card.quantity} ${card.name}`);
      }
      const textBlocks = [
        blocks.commander.length ? `Commander\n${blocks.commander.join("\n")}` : "",
        blocks.main.length ? `Deck\n${blocks.main.join("\n")}` : "",
        blocks.side.length ? `Sideboard\n${blocks.side.join("\n")}` : "",
        blocks.maybe.length ? `Maybeboard\n${blocks.maybe.join("\n")}` : "",
      ].filter(Boolean);
      setText(textBlocks.join("\n\n"));
      setProgress(data.name ? `Loaded ${data.name}` : null);
    } catch {
      setError("Could not reach the import service.");
    } finally {
      setBusy(false);
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
    <div className={styles.wrap} ref={anchorRef}>
      <button
        type="button"
        className={`${styles.trigger}${triggerClassName ? ` ${triggerClassName}` : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {open ? "Close Import" : title}
      </button>

      {open &&
        createPortal(
        <div className={styles.panel} ref={panelRef} style={panelStyle}>
          <div className={styles.panelTop}>
            <div
              className={styles.dragHandle}
              onPointerDown={onHandlePointerDown}
            >
              Bulk Import
            </div>
            <button
              type="button"
              className={styles.closeBtn}
              data-no-drag
              aria-label="Close"
              onClick={() => setOpen(false)}
            >
              ×
            </button>
          </div>
          <p className={styles.hint}>
            Paste a list, or a public Archidekt, Moxfield, MTGGoldfish, or Deckstats link.
            Commander and sideboard sections stay on those boards.
          </p>
          <div className={styles.urlRow}>
            <input
              className={styles.urlInput}
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://www.archidekt.com/decks/…"
              disabled={busy}
            />
            <button
              type="button"
              className={styles.ghostBtn}
              disabled={busy || !link.trim()}
              onClick={() => void fetchLink()}
            >
              Fetch
            </button>
          </div>
          <input
            type="file"
            accept="application/json,.json"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const raw = await file.text();
              const lines = namesFromTtsJson(raw).map((c) => `${c.quantity} ${c.name}`);
              setText(lines.join("\n"));
              e.target.value = "";
            }}
          />
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
          {existingOracleIds && (
            <label className={styles.missingToggle}>
              <input
                type="checkbox"
                checked={missingOnly}
                onChange={(e) => {
                  setMissingOnly(e.target.checked);
                  setPreview(null);
                }}
              />
              Missing only
            </label>
          )}
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

          <div
            className={`${styles.resizeHandle} ${styles.resizeE}`}
            data-no-drag
            onPointerDown={onResizePointerDown("e")}
          />
          <div
            className={`${styles.resizeHandle} ${styles.resizeS}`}
            data-no-drag
            onPointerDown={onResizePointerDown("s")}
          />
          <div
            className={`${styles.resizeHandle} ${styles.resizeSe}`}
            data-no-drag
            onPointerDown={onResizePointerDown("se")}
          />
          <div className={styles.actions} data-no-drag>
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
        , document.body)}
    </div>
  );
}

// Re-export type for callers that only need the parse shape
export type { ParsedCardLine };
