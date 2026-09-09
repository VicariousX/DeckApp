import { useEffect, useRef, useState } from "react";
import styles from "./ToolsMenu.module.css";

export type ToolsMenuProps = {
  cardSize: number;
  onCardSizeChange: (size: number) => void;
  sizeMin?: number;
  sizeMax?: number;
};

/**
 * Discreet ⋯ menu for view tools (card size, future options).
 * Positioned on the right, level with the search bar.
 */
export function ToolsMenu({
  cardSize,
  onCardSizeChange,
  sizeMin = 160,
  sizeMax = 340,
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
        aria-label="View tools"
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
            <div className={styles.menuHeading}>Card size</div>
            <label className={styles.sizeRow} htmlFor="tools-card-size">
              <input
                id="tools-card-size"
                className={styles.sizeRange}
                type="range"
                min={sizeMin}
                max={sizeMax}
                step={10}
                value={cardSize}
                onChange={(e) => onCardSizeChange(Number(e.target.value))}
              />
              <span className={styles.sizeValue}>{cardSize}px</span>
            </label>
          </div>
          {/* Future tools can be added as more .menuSection blocks */}
        </div>
      )}
    </div>
  );
}
