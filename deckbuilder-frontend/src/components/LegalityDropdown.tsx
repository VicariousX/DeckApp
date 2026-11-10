import { useState } from "react";
import type { LegalityIssue } from "../lib/formats/checkLegality";
import styles from "../pages/DeckBuilderPage.module.css";

type Props = {
  issues: LegalityIssue[];
};

export function LegalityDropdown({ issues }: Props) {
  const [open, setOpen] = useState(false);
  if (issues.length === 0) return null;

  return (
    <div className={styles.legalDrop}>
      <button
        type="button"
        className={styles.legalToggle}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {issues.length} legality issue{issues.length === 1 ? "" : "s"}
        <span className={styles.legalChevron}>{open ? "▴" : "▾"}</span>
      </button>
      {open && (
        <ul className={styles.legalList}>
          {issues.map((issue) => (
            <li key={`${issue.code}-${issue.oracleId || issue.message}`} className={styles.legalItem}>
              {issue.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
