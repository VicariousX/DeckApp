import { useEffect, useRef, useState } from "react";
import styles from "./ToolsMenu.module.css";
import type { SearchTargetRef } from "../services/searchTargetService";
import { PillSwitch } from "./PillSwitch";

export type ToolsMenuProps = {
  targets?: SearchTargetRef[];
  targetKey?: string;
  onTargetChange?: (key: string) => void;
  pinned?: string[];
  onTogglePin?: (key: string) => void;
  showTargetChip?: boolean;
  onShowTargetChipChange?: (on: boolean) => void;
  columns?: number;
  onColumnsChange?: (columns: number) => void;
  columnsMin?: number;
  columnsMax?: number;
};

/**
 * Discreet ⋯ menu for search settings (target group, future options).
 * Positioned on the right, level with the search bar.
 */
export function ToolsMenu({
  targets = [],
  targetKey = "",
  onTargetChange,
  pinned = [],
  onTogglePin,
  showTargetChip = true,
  onShowTargetChipChange,
  columns,
  onColumnsChange,
  columnsMin = 1,
  columnsMax = 8,
}: ToolsMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className={styles.anchor} ref={rootRef}>
      <button
        type="button"
        className={`${styles.trigger} ${open ? styles.triggerOpen : ""}`}
        aria-label="Search settings"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={styles.dots} aria-hidden>
          <span />
          <span />
          <span />
        </span>
      </button>

      {open && (
        <div className={styles.menu} role="menu">
          <div className={styles.menuSection}>
            <div className={styles.menuHeading}>Target group</div>
            {targets.length === 0 ? (
              <p className={styles.hint}>No targetable groups. Enable one from Drawers, Collections, or a deck.</p>
            ) : (
              <>
                <select
                  className={styles.select}
                  value={targetKey}
                  onChange={(e) => onTargetChange?.(e.target.value)}
                  aria-label="Search target group"
                >
                  <option value="">None</option>
                  {[...targets]
                    .sort((a, b) => {
                      const ak = `${a.kind}:${a.id}`;
                      const bk = `${b.kind}:${b.id}`;
                      const ap = pinned.includes(ak) ? 0 : 1;
                      const bp = pinned.includes(bk) ? 0 : 1;
                      return ap - bp || a.name.localeCompare(b.name);
                    })
                    .map((t) => {
                      const key = `${t.kind}:${t.id}`;
                      const isPinned = pinned.includes(key);
                      return (
                        <option key={key} value={key}>
                          {isPinned ? "★ " : ""}{t.kind} · {t.name}
                        </option>
                      );
                    })}
                </select>
                {targetKey && onTogglePin && (
                  <button
                    type="button"
                    className={styles.hint}
                    style={{ marginTop: 6, cursor: "pointer", background: "none", border: "none", color: "inherit", textAlign: "left", padding: 0 }}
                    onClick={() => onTogglePin(targetKey)}
                  >
                    {pinned.includes(targetKey) ? "Unpin this target" : "Pin this target"}
                  </button>
                )}
              </>
            )}
          </div>
          {onShowTargetChipChange && (
            <div className={styles.menuSection}>
              <PillSwitch
                checked={showTargetChip}
                onChange={onShowTargetChipChange}
                label="Show target indicator"
              />
            </div>
          )}
          {onColumnsChange && columns != null && (
            <div className={styles.menuSection}>
              <div className={styles.menuHeading}>Catalog size</div>
              <label className={styles.sizeRow} htmlFor="tools-card-size">
                <input
                  id="tools-card-size"
                  className={styles.sizeRange}
                  type="range"
                  min={columnsMin}
                  max={columnsMax}
                  step={1}
                  value={columnsMax + columnsMin - columns}
                  onChange={(e) => {
                    const size = Number(e.target.value);
                    onColumnsChange(columnsMax + columnsMin - size);
                  }}
                />
                <span className={styles.sizeValue}>{columns} col</span>
              </label>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
