import { createPortal } from "react-dom";
import { useMemo, useState } from "react";
import { useDraggablePanel } from "../hooks/useDraggablePanel";
import {
  copyTextToClipboard,
  downloadTextFile,
  exportFilename,
  formatTextExport,
  type ExportSection,
  type TextExportOptions,
} from "../lib/cards/exportCardList";
import styles from "./TextExportMenu.module.css";

type Props = {
  sections: ExportSection[];
  fileBaseName: string;
  options?: TextExportOptions;
  label?: string;
  /** When set, export can switch between filtered and full lists. */
  allSections?: ExportSection[];
  extraSections?: ExportSection[];
  extraLabel?: string;
  triggerClassName?: string;
};

export function TextExportMenu({
  sections,
  fileBaseName,
  options,
  label = "Export",
  allSections,
  extraSections,
  extraLabel = "Include extras",
  triggerClassName,
}: Props) {
  const [open, setOpen] = useState(false);
  const [useFilter, setUseFilter] = useState(true);
  const [includeExtra, setIncludeExtra] = useState(false);
  const { panelRef, anchorRef, panelStyle, onHandlePointerDown, onResizePointerDown } = useDraggablePanel(open, { w: 380, h: 360 });
  const [status, setStatus] = useState<string | null>(null);

  const baseSections =
    allSections && !useFilter ? allSections : sections;
  const activeSections =
    includeExtra && extraSections?.length
      ? [...baseSections, ...extraSections]
      : baseSections;

  const text = useMemo(
    () => formatTextExport(activeSections, options),
    [activeSections, options]
  );

  const total = useMemo(
    () =>
      activeSections.reduce(
        (n, s) => n + s.items.reduce((m, i) => m + (i.quantity ?? 1), 0),
        0
      ),
    [activeSections]
  );

  async function onCopy() {
    const ok = await copyTextToClipboard(text);
    setStatus(ok ? "Copied to clipboard" : "Copy failed");
    setTimeout(() => setStatus(null), 2000);
  }

  function onDownload() {
    downloadTextFile(exportFilename(fileBaseName), text);
    setStatus("Download started");
    setTimeout(() => setStatus(null), 2000);
  }

  if (total === 0) {
    return (
      <button type="button" className={`${styles.trigger}${triggerClassName ? ` ${triggerClassName}` : ""}`} disabled title="Nothing to export">
        {label}
      </button>
    );
  }

  return (
    <div className={styles.wrap} ref={anchorRef}>
      <button
        type="button"
        className={`${styles.trigger}${triggerClassName ? ` ${triggerClassName}` : ""}`}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? "Close Export" : label}
      </button>
      {open &&
        createPortal(
        <div className={styles.panel} ref={panelRef} style={panelStyle}>
          <div className={styles.panelTop}>
            <div
              className={styles.dragHandle}
              onPointerDown={onHandlePointerDown}
            >
              Export
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
          <p className={styles.meta}>
            {total} card{total === 1 ? "" : "s"} · plain text
          </p>
          {allSections && (
            <label className={styles.meta}>
              <input
                type="checkbox"
                checked={useFilter}
                onChange={(e) => setUseFilter(e.target.checked)}
              />{" "}
              Use current filters
            </label>
          )}
          {extraSections && extraSections.length > 0 && (
            <label className={styles.meta}>
              <input
                type="checkbox"
                checked={includeExtra}
                onChange={(e) => setIncludeExtra(e.target.checked)}
              />{" "}
              {extraLabel}
            </label>
          )}
          <pre className={styles.preview}>{text}</pre>
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
          <div className={styles.actions}>
            <button type="button" className={styles.primaryBtn} onClick={() => void onCopy()}>
              Copy
            </button>
            <button type="button" className={styles.ghostBtn} onClick={onDownload}>
              Download .txt
            </button>
          </div>
          {status && <p className={styles.status}>{status}</p>}
        </div>
        , document.body)}
    </div>
  );
}
