import { useEffect, useState, type KeyboardEvent } from "react";
import styles from "../pages/DeckBuilderPage.module.css";

type Props = {
  quantity: number;
  disabled?: boolean;
  onDelta: (delta: number) => void;
  onCommit: (raw: string) => void;
};

export function QtyControl({ quantity, disabled, onDelta, onCommit }: Props) {
  const [draft, setDraft] = useState(String(quantity));

  useEffect(() => {
    setDraft(String(quantity));
  }, [quantity]);

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.currentTarget.blur();
      onCommit(draft);
    } else if (e.key === "Escape") {
      setDraft(String(quantity));
      e.currentTarget.blur();
    }
  }

  return (
    <div className={styles.qtyControl}>
      <button type="button" className={styles.qtyBtn} disabled={disabled} onClick={() => onDelta(-1)} aria-label="Decrease quantity">−</button>
      <input
        className={styles.qtyInput}
        type="number"
        min={0}
        inputMode="numeric"
        disabled={disabled}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => onCommit(draft)}
        onKeyDown={onKey}
        aria-label="Quantity"
      />
      <button type="button" className={styles.qtyBtn} disabled={disabled} onClick={() => onDelta(1)} aria-label="Increase quantity">+</button>
    </div>
  );
}
