import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { cloneDeck, listPublicDecks } from "../services/deckService";
import { saveBranchParent } from "../services/deckHistory";
import type { Deck } from "../types/deck";
import styles from "./MyDecksPage.module.css";

export function PublicDecksPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [decks, setDecks] = useState<Deck[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void listPublicDecks().then(({ decks: list, error: err }) => {
      setDecks(list);
      setError(err);
    });
  }, []);

  async function copy(deck: Deck, branch: boolean) {
    if (!user) {
      navigate("/login");
      return;
    }
    const { deck: next, error: err } = await cloneDeck(deck.id, user.id, { branch });
    if (err || !next) {
      setError(err ?? "Could not copy deck.");
      return;
    }
    if (branch) saveBranchParent(next.id, deck.id);
    navigate(`/deck/${next.id}`);
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Public decks</h1>
          <p className={styles.subtitle}>Clone a list, or branch it to compare your own changes.</p>
        </div>
      </header>
      {error && <p className={styles.error}>{error}</p>}
      {decks.length === 0 && <p className={styles.empty}>No public decks yet.</p>}
      <ul className={styles.list}>
        {decks.map((d) => (
          <li key={d.id} className={styles.deckItem}>
            <Link to={`/deck/${d.id}`} className={styles.deckLink}>
              <span className={styles.deckName}>{d.name}</span>
              <span className={styles.deckMeta}>{d.format}</span>
            </Link>
            <button type="button" className={styles.deleteBtn} onClick={() => void copy(d, false)}>Clone</button>
            <button type="button" className={styles.deleteBtn} onClick={() => void copy(d, true)}>Branch</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
