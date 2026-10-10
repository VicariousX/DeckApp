import type { HouseFormat } from "../lib/formats/rules";
import styles from "../pages/FormatsPage.module.css";

export function HouseFormatEditor({
  draft,
  setDraft,
  onSave,
  saveLabel,
}: {
  draft: HouseFormat;
  setDraft: (next: HouseFormat) => void;
  onSave: () => void;
  saveLabel: string;
}) {
  return (
    <form
      className={styles.form}
      onSubmit={(e) => {
        e.preventDefault();
        onSave();
      }}
    >
      <div className={styles.grid}>
        <label className={styles.field}>
          <span>Name</span>
          <input className={styles.input} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} required />
        </label>
        <label className={styles.field}>
          <span>Deck size</span>
          <input
            className={styles.input}
            type="number"
            min={0}
            value={draft.deckSize ?? ""}
            onChange={(e) => setDraft({ ...draft, deckSize: e.target.value ? Number(e.target.value) : null })}
          />
        </label>
        <label className={styles.field}>
          <span>Copy limit</span>
          <input
            className={styles.input}
            type="number"
            min={1}
            value={draft.copyLimit}
            onChange={(e) => setDraft({ ...draft, copyLimit: Number(e.target.value) || 1 })}
          />
        </label>
      </div>
      <div className={styles.toggles}>
        <label className={styles.toggle}>
          <input type="checkbox" checked={draft.singleton} onChange={(e) => setDraft({ ...draft, singleton: e.target.checked })} />
          <span>Singleton</span>
        </label>
        <label className={styles.toggle}>
          <input type="checkbox" checked={draft.commanderRequired} onChange={(e) => setDraft({ ...draft, commanderRequired: e.target.checked })} />
          <span>Commander required</span>
        </label>
        <label className={styles.toggle}>
          <input type="checkbox" checked={draft.colorIdentity} onChange={(e) => setDraft({ ...draft, colorIdentity: e.target.checked })} />
          <span>Color identity</span>
        </label>
      </div>
      <label className={styles.field}>
        <span>Banned cards</span>
        <textarea
          className={styles.textarea}
          value={draft.banned.join("\n")}
          onChange={(e) => setDraft({ ...draft, banned: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })}
        />
      </label>
      <label className={styles.field}>
        <span>Notes</span>
        <textarea className={styles.textarea} value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
      </label>
      <div className={styles.actions}>
        <button className={styles.primaryBtn} type="submit">{saveLabel}</button>
      </div>
    </form>
  );
}
