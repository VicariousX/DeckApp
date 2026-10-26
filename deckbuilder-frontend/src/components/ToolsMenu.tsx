import { useEffect, useRef, useState } from "react";
import styles from "./ToolsMenu.module.css";
import type { SearchTargetRef } from "../services/searchTargetService";

export type ToolsMenuProps = {
  targets?: SearchTargetRef[];
  targetKey?: string;
  onTargetChange?: (key: string) => void;
  showTargetChip?: boolean;
  onShowTargetChipChange?: (on: boolean) => void;
  cardSize?: number;
  onCardSizeChange?: (size: number) => void;
  sizeMin?: number;
  sizeMax?: number;
};

/**
 * Discreet ⋯ menu for search settings (target group, future options).
 * Positioned on the right, level with the search bar.
 */
export function ToolsMenu({
  targets = [],
  targetKey = "",
  onTargetChange,
  showTargetChip = true,
  onShowTargetChipChange,
  cardSize,
  onCardSizeChange,
  sizeMin = 96,
  sizeMax = 360,
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
              <select
                className={styles.select}
                value={targetKey}
                onChange={(e) => onTargetChange?.(e.target.value)}
                aria-label="Search target group"
              >
                <option value="">None</option>
                {targets.map((t) => (
                  <option key={`${t.kind}:${t.id}`} value={`${t.kind}:${t.id}`}>
                    {t.kind} · {t.name}
                  </option>
                ))}
              </select>
            )}
          </div>
          {onShowTargetChipChange && (
            <div className={styles.menuSection}>
              <label className={styles.checkRow}>
                <input
                  type="checkbox"
                  checked={showTargetChip}
                  onChange={(e) => onShowTargetChipChange(e.target.checked)}
                />
                Show target indicator
              </label>
            </div>
          )}
          {onCardSizeChange && cardSize != null && (
            <div className={styles.menuSection}>
              <div className={styles.menuHeading}>Catalog tile size</div>
              <label className={styles.sizeRow} htmlFor="tools-card-size">
                <input
                  id="tools-card-size"
                  className={styles.sizeRange}
                  type="range"
                  min={sizeMin}
                  max={sizeMax}
                  step={8}
                  value={cardSize}
                  onChange={(e) => onCardSizeChange(Number(e.target.value))}
                />
                <span className={styles.sizeValue}>{cardSize}px</span>
              </label>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
