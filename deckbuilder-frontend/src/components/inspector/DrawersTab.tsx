import type { ScryfallCard } from "../../types/scryfallCard";
import { DrawerPicker } from "../DrawerPicker";
import { UsefulInPicker } from "../UsefulInPicker";
import styles from "../CardInspectorModal.module.css";

export function DrawersTab({
  card,
  usefulInTags,
  onUsefulInChange,
}: {
  card: ScryfallCard | null;
  usefulInTags: string[];
  onUsefulInChange: (next: string[]) => void;
}) {
  if (!card) {
    return <p className={styles.muted}>Load card to manage drawers.</p>;
  }
  const oracleId = (card.oracle_id ?? card.id).toLowerCase();
  return (
    <>
      <div className={styles.usefulInBlock}>
        <UsefulInPicker
          oracleId={oracleId}
          scryfallCard={card}
          value={usefulInTags}
          onChange={onUsefulInChange}
        />
      </div>
      <div className={styles.drawersBlock}>
        <p className={styles.drawersBlockLabel}>Drawer membership</p>
        <DrawerPicker oracleId={oracleId} scryfallCard={card} inline />
      </div>
    </>
  );
}
