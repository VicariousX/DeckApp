import type { ScryfallCard } from "../../types/scryfallCard";
import { DrawerPicker } from "../DrawerPicker";
import { UsefulInPicker } from "../UsefulInPicker";
import type { CardInspectorDrawerControls } from "./types";
import styles from "../CardInspectorModal.module.css";

export function DrawersTab({
  card,
  usefulInTags,
  onUsefulInChange,
  drawer,
}: {
  card: ScryfallCard | null;
  usefulInTags: string[];
  onUsefulInChange: (next: string[]) => void;
  drawer?: CardInspectorDrawerControls;
}) {
  if (!card) {
    return <p className={styles.muted}>Load card to manage drawers.</p>;
  }
  const oracleId = (card.oracle_id ?? card.id).toLowerCase();
  return (
    <>
      {drawer && (
        <div className={styles.deckExtras}>
          <div className={styles.deckGroup}>
            <span className={styles.extraLabel}>This drawer</span>
            <p className={styles.qtyValue}>{drawer.drawerName}</p>
          </div>
          <div className={`${styles.qtyRow} ${styles.deckGroup}`}>
            <span className={styles.extraLabel}>Tier</span>
            <div className={styles.qtyControls}>
              <button
                type="button"
                className={styles.qtyBtn}
                disabled={!drawer.isOwner || drawer.tier <= 1}
                onClick={() => drawer.onTier(Math.max(1, drawer.tier - 1))}
              >
                −
              </button>
              <span className={styles.qtyValue}>{drawer.tier}</span>
              <button
                type="button"
                className={styles.qtyBtn}
                disabled={!drawer.isOwner}
                onClick={() => drawer.onTier(drawer.tier + 1)}
              >
                +
              </button>
            </div>
          </div>
          {drawer.isOwner && (
            <div className={styles.deckFooter}>
              <button
                type="button"
                className={styles.removeBtn}
                onClick={drawer.onRemove}
              >
                Remove from {drawer.drawerName}
              </button>
            </div>
          )}
        </div>
      )}
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