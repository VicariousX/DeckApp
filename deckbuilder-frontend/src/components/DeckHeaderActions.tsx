import { Link } from "react-router-dom";
import { updateDeck } from "../services/deckService";
import type { Deck } from "../types/deck";
import styles from "../pages/DeckBuilderPage.module.css";

type Props = {
  isMobile: boolean;
  user: { id: string } | null;
  isOwner: boolean;
  parentId: string | null;
  deck: Deck;
  deckId: string;
  onClone: () => void;
  onBranches: () => void;
  onHistory: () => void;
  onError: (msg: string) => void;
  onDeckUpdate: (deck: Deck) => void;
};

export function DeckHeaderActions({
  isMobile, user, isOwner, parentId, deck, deckId,
  onClone, onBranches, onHistory, onError, onDeckUpdate,
}: Props) {
  async function togglePublic() {
    const next = !deck.is_public;
    const { deck: updated, error } = await updateDeck(deckId, { is_public: next });
    if (error || !updated) {
      onError(error ?? "Could not update visibility");
      return;
    }
    onDeckUpdate(updated);
  }

  if (isMobile) {
    return (
      <div className={styles.headerMenuWrap}>
        <details className={styles.headerMenu}>
          <summary className={styles.secondaryBtn}>⋮</summary>
          <div>
            {user && (
              <>
                <button type="button" onClick={onClone}>Clone</button>
                <button type="button" onClick={onBranches}>Branches</button>
              </>
            )}
            {isOwner && <button type="button" onClick={onHistory}>History</button>}
            {parentId && <Link to={`/deck/${parentId}`}>Parent</Link>}
            {isOwner && (
              <button type="button" onClick={() => void togglePublic()}>
                {deck.is_public ? "Public" : "Make public"}
              </button>
            )}
          </div>
        </details>
      </div>
    );
  }

  return (
    <>
      {user && (
        <>
          <button type="button" className={styles.secondaryBtn} onClick={onClone}>Clone</button>
          <button type="button" className={styles.secondaryBtn} onClick={onBranches}>Branches</button>
        </>
      )}
      {isOwner && (
        <button type="button" className={styles.secondaryBtn} onClick={onHistory}>History</button>
      )}
      {parentId && <Link to={`/deck/${parentId}`} className={styles.backLink}>Parent</Link>}
      {isOwner ? (
        <button type="button" className={styles.secondaryBtn} onClick={() => void togglePublic()}>
          {deck.is_public ? "Public" : "Make public"}
        </button>
      ) : deck.is_public ? (
        <span className={styles.format}>Public</span>
      ) : null}
    </>
  );
}
