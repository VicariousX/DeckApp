import { useRef, useState, type FormEvent } from "react";
import type { DeckTag } from "../types/deck";
import styles from "../pages/DeckBuilderPage.module.css";

type Props = {
  tags: DeckTag[];
  isOwner: boolean;
  newTagName: string;
  onNewTagName: (name: string) => void;
  onCreate: (e: FormEvent) => void;
  onRename: (tag: DeckTag, name: string) => void;
  onDelete: (tag: DeckTag) => void;
};

function TagChip({
  tag,
  isOwner,
  onRename,
  onDelete,
}: {
  tag: DeckTag;
  isOwner: boolean;
  onRename: (tag: DeckTag, name: string) => void;
  onDelete: (tag: DeckTag) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(tag.name);
  const skip = useRef(false);

  if (!isOwner) return <span className={styles.tagChip}>{tag.name}</span>;
  if (!editing) {
    return (
      <span className={styles.tagChip}>
        <button type="button" className={styles.tagNameBtn} onClick={() => { setValue(tag.name); setEditing(true); }}>
          {tag.name}
        </button>
        <button type="button" className={styles.tagRemove} onClick={() => onDelete(tag)} aria-label={`Delete ${tag.name}`}>
          ×
        </button>
      </span>
    );
  }
  return (
    <form
      className={styles.tagChip}
      onSubmit={(e) => {
        e.preventDefault();
        onRename(tag, value);
        setEditing(false);
      }}
    >
      <input
        className={styles.tagNameInput}
        value={value}
        maxLength={40}
        aria-label={`Rename ${tag.name}`}
        autoFocus
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => {
          if (skip.current) {
            skip.current = false;
            return;
          }
          onRename(tag, value);
          setEditing(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            skip.current = true;
            setEditing(false);
          }
        }}
      />
    </form>
  );
}

export function DeckTagsPanel({ tags, isOwner, newTagName, onNewTagName, onCreate, onRename, onDelete }: Props) {
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
          <TagChip key={t.id} tag={t} isOwner={isOwner} onRename={onRename} onDelete={onDelete} />
        ))}
        {tags.length === 0 && <span className={styles.hint}>No tags yet.</span>}
      </div>
    </section>
  );
}
