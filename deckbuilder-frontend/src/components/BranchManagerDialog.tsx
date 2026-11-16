import { Link } from "react-router-dom";
import type { BranchNode } from "../services/deckHistory";
import styles from "../pages/DeckBuilderPage.module.css";

type Props = {
  open: boolean;
  deckId: string;
  tree: BranchNode[];
  onClose: () => void;
  onNewBranch: () => void;
};

export function BranchManagerDialog({ open, deckId, tree, onClose, onNewBranch }: Props) {
  if (!open) return null;
  return (
    <div className={styles.branchManager} role="dialog" aria-label="Branches">
      <div className={styles.branchManagerHead}>
        <h2>Branches</h2>
        <button type="button" className={styles.secondaryBtn} onClick={onClose}>Close</button>
      </div>
      <p className={styles.hint}>View existing branches or start a new one from this deck.</p>
      <ul className={styles.branchList}>
        {tree.length === 0 && <li className={styles.hint}>No branches yet.</li>}
        {tree.map((node) => (
          <li key={node.id}>
            <Link to={`/deck/${node.id}`} onClick={onClose}>{node.name}</Link>
            <Link to={`/deck/${deckId}/branches`} className={styles.backLink} onClick={onClose}>Compare</Link>
          </li>
        ))}
      </ul>
      <div className={styles.branchManagerActions}>
        <button type="button" className={styles.secondaryBtn} onClick={onNewBranch}>New branch</button>
        <Link to={`/deck/${deckId}/branches`} className={styles.secondaryBtn} onClick={onClose}>Open branch tool</Link>
      </div>
    </div>
  );
}
