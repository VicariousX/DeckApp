import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { createDeck, deleteDeck, listMyDecks } from "../services/deckService";
import type { Deck } from "../types/deck";
import transitions from "../styles/pageTransitions.module.css";
import styles from "./MyDecksPage.module.css";

export function MyDecksPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [decks, setDecks] = useState<Deck[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [format, setFormat] = useState("casual");
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { decks: list, error: err } = await listMyDecks(user.id);
    setDecks(list);
    setError(err);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void reload();
  }, [reload]);

  if (!authLoading && !user) {
    return <Navigate to="/login" replace />;
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!user || !name.trim()) return;
    setBusy(true);
    setError(null);
    const { deck, error: err } = await createDeck(user.id, {
      name: name.trim(),
      format,
    });
    setBusy(false);
    if (err || !deck) {
      setError(err ?? "Could not create deck.");
      return;
    }
    setName("");
    navigate(`/deck/${deck.id}`);
  }

  async function onDelete(id: string, deckName: string) {
    if (!confirm(`Delete deck “${deckName}”? This cannot be undone.`)) return;
    const { error: err } = await deleteDeck(id);
    if (err) setError(err);
    else void reload();
  }

  return (
    <div className={`${transitions.page} ${styles.page}`}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>My decks</h1>
          <p className={styles.subtitle}>
            Create a deck, then add cards and organize with types & tags.
          </p>
        </div>
      </header>

      <form className={styles.createCard} onSubmit={onCreate}>
        <h2 className={styles.createTitle}>New deck</h2>
        <div className={styles.createRow}>
          <input
            className={styles.input}
            placeholder="Deck name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            required
          />
          <select
            className={styles.select}
            value={format}
            onChange={(e) => setFormat(e.target.value)}
            aria-label="Format"
          >
            <option value="casual">Casual</option>
            <option value="commander">Commander</option>
            <option value="standard">Standard</option>
            <option value="modern">Modern</option>
            <option value="pioneer">Pioneer</option>
            <option value="legacy">Legacy</option>
            <option value="other">Other</option>
          </select>
          <button type="submit" className={styles.primaryBtn} disabled={busy}>
            {busy ? "Creating…" : "Create"}
          </button>
        </div>
      </form>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      {loading && <p className={styles.status}>Loading decks…</p>}

      {!loading && decks.length === 0 && (
        <p className={styles.empty}>No decks yet. Create one above.</p>
      )}

      <ul className={styles.list}>
        {decks.map((d) => (
          <li key={d.id} className={styles.deckItem}>
            <Link to={`/deck/${d.id}`} className={styles.deckLink}>
              <span className={styles.deckName}>{d.name}</span>
              <span className={styles.deckMeta}>
                {d.format}
                {d.is_public ? " · public" : " · private"}
              </span>
            </Link>
            <button
              type="button"
              className={styles.deleteBtn}
              onClick={() => onDelete(d.id, d.name)}
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
