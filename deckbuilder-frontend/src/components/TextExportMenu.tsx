import { useMemo, useState } from "react";
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
};

export function TextExportMenu({
  sections,
  fileBaseName,
  options,
  label = "Export",
}: Props) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const text = useMemo(
    () => formatTextExport(sections, options),
    [sections, options]
  );

  const total = useMemo(
    () =>
      sections.reduce(
        (n, s) => n + s.items.reduce((m, i) => m + (i.quantity ?? 1), 0),
        0
      ),
    [sections]
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
      <button type="button" className={styles.trigger} disabled title="Nothing to export">
        {label}
      </button>
    );
  }

  return (
    <div className={styles.wrap}>
      <button
        type="button"
        className={styles.trigger}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {label}
      </button>
      {open && (
        <div className={styles.panel}>
          <p className={styles.meta}>
            {total} card{total === 1 ? "" : "s"} · plain text
          </p>
          <pre className={styles.preview}>{text}</pre>
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
      )}
    </div>
  );
}
