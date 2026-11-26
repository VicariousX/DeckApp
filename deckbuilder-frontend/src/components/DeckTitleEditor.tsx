import { useEffect, useState, type FormEvent } from "react";
import styles from "../pages/DeckBuilderPage.module.css";

type Props = {
  name: string;
  description: string;
  isOwner: boolean;
  onSave: (next: { name: string; description: string }) => Promise<string | null>;
};

export function DeckTitleEditor({ name, description, isOwner, onSave }: Props) {
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(name);
  const [draftDesc, setDraftDesc] = useState(description);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editing) return;
    setDraftName(name);
    setDraftDesc(description);
  }, [name, description, editing]);

  async function save(e?: FormEvent) {
    e?.preventDefault();
    const nextName = draftName.trim();
    const nextDesc = draftDesc.trim();
    if (!nextName) {
      setError("Give the deck a name.");
      return;
    }
    if (nextName === name && nextDesc === description.trim()) {
      setEditing(false);
      setError(null);
      return;
    }
    setBusy(true);
    setError(null);
    const err = await onSave({ name: nextName, description: nextDesc });
    setBusy(false);
    if (err) {
      setError(err);
      return;
    }
    setEditing(false);
  }

  if (!isOwner) {
    return (
      <div>
        <h1 className={styles.title}>{name}</h1>
        {description.trim() ? <p className={styles.deckDesc}>{description}</p> : null}
      </div>
    );
  }

  if (!editing) {
    return (
      <div>
        <button type="button" className={styles.titleBtn} onClick={() => setEditing(true)}>
          {name}
        </button>
        <button type="button" className={styles.descBtn} onClick={() => setEditing(true)}>
          {description.trim() || "Add a description"}
        </button>
      </div>
    );
  }

  return (
    <form className={styles.identityForm} onSubmit={(e) => void save(e)}>
      <input
        className={styles.titleInput}
        value={draftName}
        maxLength={80}
        aria-label="Deck name"
        autoFocus
        onChange={(e) => setDraftName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setEditing(false);
            setError(null);
          }
        }}
      />
      <textarea
        className={styles.descInput}
        value={draftDesc}
        maxLength={280}
        rows={2}
        aria-label="Deck description"
        placeholder="Description"
        onChange={(e) => setDraftDesc(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setEditing(false);
            setError(null);
          }
        }}
      />
      <div className={styles.identityActions}>
        <button type="submit" className={styles.secondaryBtn} disabled={busy}>
          {busy ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          className={styles.ghostBtn}
          onClick={() => {
            setEditing(false);
            setError(null);
          }}
        >
          Cancel
        </button>
      </div>
      {error ? <p className={styles.hint}>{error}</p> : null}
    </form>
  );
}
