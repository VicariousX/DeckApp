import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { CopyReadyDialog } from "../components/CopyReadyDialog";
import { cloneDeck, listPublicDecks } from "../services/deckService";
import { rememberBranchNode, saveBranchParent } from "../services/deckHistory";
import type { Deck } from "../types/deck";
import styles from "./MyDecksPage.module.css";

export function PublicDecksPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [decks, setDecks] = useState<Deck[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ask, setAsk] = useState<{ deck: Deck; branch: boolean } | null>(null);
  const [ready, setReady] = useState<{ id: string; name: string; branch: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

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
    setBusy(true);
    const { deck: next, error: err } = await cloneDeck(deck.id, user.id, { branch });
    setBusy(false);
    if (err || !next) {
      setError(err ?? "Could not copy deck.");
      return;
    }
    if (branch) {
      rememberBranchNode({ id: deck.id, name: deck.name, parentId: null, createdAt: deck.created_at });
      saveBranchParent(next.id, deck.id, next.name);
    }
    setAsk(null);
    setReady({ id: next.id, name: next.name, branch });
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
            <button type="button" className={styles.deleteBtn} onClick={() => setAsk({ deck: d, branch: false })}>Clone</button>
            <button type="button" className={styles.deleteBtn} onClick={() => setAsk({ deck: d, branch: true })}>Branch</button>
          </li>
        ))}
      </ul>
      {ask && (
        <CopyReadyDialog
          title={ask.branch ? "Branch this public deck?" : "Clone this public deck?"}
          body={ask.branch ? "This makes a private branch linked to the public deck." : "This makes a private copy."}
          confirmLabel={ask.branch ? "Branch" : "Clone"}
          cancelLabel="Cancel"
          busy={busy}
          onCancel={() => setAsk(null)}
          onConfirm={() => void copy(ask.deck, ask.branch)}
        />
      )}
      {ready && (
        <CopyReadyDialog
          title={ready.branch ? "Branch ready" : "Clone ready"}
          body={`${ready.name} has been built.`}
          cancelLabel="Stay here"
          onCancel={() => setReady(null)}
          extra={{ label: "Open new deck", onClick: () => navigate(`/deck/${ready.id}`) }}
        />
      )}
    </div>
  );
}
