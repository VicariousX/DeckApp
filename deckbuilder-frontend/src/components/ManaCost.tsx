import { parseManaCost, renderManaSymbol } from "../utils/symbols";
import styles from "./ManaCost.module.css";

type Props = {
  cost: string | null | undefined;
  size?: number;
  className?: string;
};

/** Inline Scryfall mana symbols for a cost string like "{2}{W}{U}". */
export function ManaCost({ cost, size = 14, className }: Props) {
  if (!cost) return null;
  const symbols = parseManaCost(cost);
  if (symbols.length === 0) return null;
  return (
    <span className={`${styles.row} ${className ?? ""}`} aria-label={cost}>
      {symbols.map((sym, i) => (
        <span key={`${sym}-${i}`} className={styles.sym}>
          {renderManaSymbol(sym, size)}
        </span>
      ))}
    </span>
  );
}
