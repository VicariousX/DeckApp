import { useSyncExternalStore } from "react";
import { CARD_SIZE, readCardSize, subscribeCardSize, writeCardSize, type CardSizeKey } from "../lib/cardSize";
import styles from "./CardSizeSlider.module.css";

export function SizeSlider({
  label = "Card size",
  min,
  max,
  step = 2,
  value,
  onChange,
}: {
  label?: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className={styles.row}>
      <span className={styles.label}>{label}</span>
      <input
        className={styles.range}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className={styles.value}>{Math.round(value)}</span>
    </label>
  );
}

export function CardSizeSlider({ sizeKey, label = "Card size" }: { sizeKey: CardSizeKey; label?: string }) {
  const size = useSyncExternalStore(subscribeCardSize, () => readCardSize(sizeKey), () => CARD_SIZE[sizeKey].fallback);
  const spec = CARD_SIZE[sizeKey];
  return (
    <SizeSlider
      label={label}
      min={spec.min}
      max={spec.max}
      value={size}
      onChange={(n) => writeCardSize(sizeKey, n)}
    />
  );
}

export function useCardSize(key: CardSizeKey): number {
  return useSyncExternalStore(subscribeCardSize, () => readCardSize(key), () => CARD_SIZE[key].fallback);
}
