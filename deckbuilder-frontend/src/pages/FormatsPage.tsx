import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { HouseFormatEditor } from "../components/HouseFormatEditor";
import {
  blankHouseFormat,
  loadHouseFormats,
  saveHouseFormats,
} from "../services/houseFormatService";
import type { HouseFormat } from "../lib/formats/rules";
import styles from "./FormatsPage.module.css";

export function FormatsPage() {
  const [formats, setFormats] = useState<HouseFormat[]>([]);
  const [draft, setDraft] = useState<HouseFormat>(blankHouseFormat());

  useEffect(() => {
    setFormats(loadHouseFormats());
  }, []);

  function persist(next: HouseFormat[]) {
    setFormats(next);
    saveHouseFormats(next);
  }

  function saveDraft() {
    const name = draft.name.trim();
    if (!name) return;
    const row = { ...draft, name, isPublic: false };
    const next = formats.some((f) => f.id === row.id)
      ? formats.map((f) => (f.id === row.id ? row : f))
      : [...formats, row];
    persist(next);
    setDraft(blankHouseFormat());
  }

  const editing = formats.some((f) => f.id === draft.id);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Formats</h1>
          <p className={styles.subtitle}>
            Built-in formats are checked on the deck. House formats stay private and can be chosen from the deck header.
          </p>
        </div>
      </header>

      {formats.length > 0 && (
        <div className={styles.toggles}>
          {formats.map((f) => (
            <button key={f.id} type="button" className={styles.deleteBtn} onClick={() => setDraft(f)}>
              {f.name}
            </button>
          ))}
          <button type="button" className={styles.deleteBtn} onClick={() => setDraft(blankHouseFormat())}>New</button>
        </div>
      )}

      <HouseFormatEditor draft={draft} setDraft={setDraft} onSave={saveDraft} saveLabel={editing ? "Update format" : "Save format"} />

      <ul className={styles.list}>
        {formats.map((f) => (
          <li key={f.id} className={styles.item}>
            <button type="button" className={styles.open} onClick={() => setDraft(f)}>
              <span className={styles.name}>{f.name}</span>
              <span className={styles.meta}>
                {f.deckSize || "any"} cards · {f.singleton ? "singleton" : `${f.copyLimit} copies`}
              </span>
            </button>
            <button type="button" className={styles.deleteBtn} onClick={() => persist(formats.filter((x) => x.id !== f.id))}>
              Delete
            </button>
          </li>
        ))}
      </ul>
      {formats.length === 0 && <p className={styles.empty}>No house formats yet. The editor above starts one.</p>}
      <p className={styles.status}>
        Choose a house format from the deck header. <Link to="/my-decks">My decks</Link>
      </p>
    </div>
  );
}