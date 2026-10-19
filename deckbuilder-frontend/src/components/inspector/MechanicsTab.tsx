import type { ScryfallCard } from "../../types/scryfallCard";
import { MechanicMarkPicker } from "../MechanicMarkPicker";
import styles from "../CardInspectorModal.module.css";

export function MechanicsTab({ card }: { card: ScryfallCard | null }) {
  const oracleId = card?.oracle_id ?? card?.id;
  if (!oracleId) {
    return <p className={styles.muted}>Load card to mark mechanics.</p>;
  }
  return (
    <div className={styles.panelScroll}>
      <MechanicMarkPicker oracleId={oracleId.toLowerCase()} />
    </div>
  );
}
