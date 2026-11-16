import { useEffect, useRef } from "react";
import type { DeckCard, DeckTag } from "../types/deck";
import styles from "../pages/DeckBuilderPage.module.css";

type Props = {
  card: DeckCard;
  tags: DeckTag[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onToggle: (tag: DeckTag) => void;
};

export function CardTagPicker({ card, tags, open, onOpenChange, onToggle }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const assigned = new Set(card.tag_ids ?? []);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: globalThis.MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) onOpenChange(false);
    }
    function onKey(e: globalThis.KeyboardEvent) {
      if (e.key === "Escape") onOpenChange(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onOpenChange]);

  if (tags.length === 0) {
    return <span className={styles.hint} title="Create tags in the Tags panel">No tags</span>;
  }

  return (
    <div className={styles.tagPicker} ref={wrapRef}>
      <button
        type="button"
        className={styles.tagPickerBtn}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => onOpenChange(!open)}
      >
        Add tag
      </button>
      {open && (
        <ul className={styles.tagPickerMenu} role="listbox">
          {tags.map((t) => {
            const on = assigned.has(t.id);
            return (
              <li key={t.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={on}
                  className={on ? `${styles.tagPickerItem} ${styles.tagPickerItemOn}` : styles.tagPickerItem}
                  onClick={() => onToggle(t)}
                >
                  <span>{t.name}</span>
                  {on && <span aria-hidden>✓</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
