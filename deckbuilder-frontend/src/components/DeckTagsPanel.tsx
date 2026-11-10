import type { FormEvent } from "react";
import type { DeckTag } from "../types/deck";
import styles from "../pages/DeckBuilderPage.module.css";

type Props = {
  tags: DeckTag[];
  isOwner: boolean;
  newTagName: string;
  onNewTagName: (name: string) => void;
  onCreate: (e: FormEvent) => void;
  onDelete: (tag: DeckTag) => void;
};

export function DeckTagsPanel({ tags, isOwner, newTagName, onNewTagName, onCreate, onDelete }: Props) {
  return (
    <section className={styles.tagsPanel}>
      <h2 className={styles.sectionLabel}>Deck tags</h2>
      <p className={styles.hint}>
        Create tags here, then pin them to individual cards from the deck list with <strong>Add tag</strong>.
      </p>
      {isOwner && (
        <form className={styles.tagForm} onSubmit={onCreate}>
          <input
            className={styles.input}
            placeholder="New tag name"
            value={newTagName}
            onChange={(e) => onNewTagName(e.target.value)}
            maxLength={40}
          />
          <button type="submit" className={styles.secondaryBtn}>Create tag</button>
        </form>
      )}
      <div className={styles.tagChips}>
        {tags.map((t) => (
          <span key={t.id} className={styles.tagChip}>
            {t.name}
            {isOwner && (
              <button
                type="button"
                className={styles.tagRemove}
                onClick={() => onDelete(t)}
                aria-label={`Delete ${t.name}`}
              >
                ×
              </button>
            )}
          </span>
        ))}
        {tags.length === 0 && <span className={styles.hint}>No tags yet.</span>}
      </div>
    </section>
  );
}
