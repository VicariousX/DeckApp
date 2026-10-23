import type { MembershipMeasure } from "../services/membershipService";
import styles from "./DrawersPage.module.css";

type Props = {
  memberships: MembershipMeasure[];
  onRemove?: (m: MembershipMeasure) => void;
  emptyText?: string;
};

/** Shared list of group memberships (decks / drawers / collections) with measure. */
export function MembershipList({ memberships, onRemove, emptyText = "Not in any groups." }: Props) {
  if (memberships.length === 0) {
    return <p className={styles.muted}>{emptyText}</p>;
  }
  return (
    <ul className={styles.drawerList}>
      {memberships.map((m) => (
        <li key={`${m.kind}-${m.groupId}-${m.board ?? ""}`} className={styles.drawerItem}>
          <span className={styles.drawerName}>
            {m.groupName}
            {m.board ? ` (${m.board})` : ""}
          </span>
          <span className={styles.drawerCount}>{m.label}</span>
          {onRemove && (
            <button
              type="button"
              className={styles.ghostBtn}
              onClick={() => onRemove(m)}
              style={{ marginLeft: 8 }}
            >
              Remove
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
