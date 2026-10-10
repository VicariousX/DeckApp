import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
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
            Built-in formats are checked on the deck. House formats stay private for now.
          </p>
        </div>
      </header>

      <form
        className={styles.form}
        onSubmit={(e) => {
          e.preventDefault();
          saveDraft();
        }}
      >
        <h2 className={styles.formTitle}>{editing ? "Edit format" : "New house format"}</h2>
        <div className={styles.grid}>
          <label className={styles.field}>
            <span>Name</span>
            <input
              className={styles.input}
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              required
            />
          </label>
          <label className={styles.field}>
            <span>Deck size</span>
            <input
              className={styles.input}
              type="number"
              min={0}
              value={draft.deckSize ?? ""}
              onChange={(e) =>
                setDraft({ ...draft, deckSize: e.target.value ? Number(e.target.value) : null })
              }
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
            <input
              type="checkbox"
              checked={draft.singleton}
              onChange={(e) => setDraft({ ...draft, singleton: e.target.checked })}
            />
            <span>Singleton</span>
          </label>
          <label className={styles.toggle}>
            <input
              type="checkbox"
              checked={draft.commanderRequired}
              onChange={(e) => setDraft({ ...draft, commanderRequired: e.target.checked })}
            />
            <span>Commander required</span>
          </label>
          <label className={styles.toggle}>
            <input
              type="checkbox"
              checked={draft.colorIdentity}
              onChange={(e) => setDraft({ ...draft, colorIdentity: e.target.checked })}
            />
            <span>Color identity</span>
          </label>
        </div>

        <label className={styles.field}>
          <span>Banned cards</span>
          <textarea
            className={styles.textarea}
            value={draft.banned.join("\n")}
            onChange={(e) =>
              setDraft({
                ...draft,
                banned: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean),
              })
            }
          />
        </label>
        <label className={styles.field}>
          <span>Notes</span>
          <textarea
            className={styles.textarea}
            value={draft.notes}
            onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
          />
        </label>
        <div className={styles.actions}>
          <button className={styles.primaryBtn} type="submit">
            {editing ? "Update" : "Save"}
          </button>
        </div>
      </form>

      <ul className={styles.list}>
        {formats.map((f) => (
          <li key={f.id} className={styles.item}>
            <button type="button" className={styles.open} onClick={() => setDraft(f)}>
              <span className={styles.name}>{f.name}</span>
              <span className={styles.meta}>
                {f.deckSize || "any"} cards · {f.singleton ? "singleton" : `${f.copyLimit} copies`}
              </span>
            </button>
            <button
              type="button"
              className={styles.deleteBtn}
              onClick={() => persist(formats.filter((x) => x.id !== f.id))}
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
      {formats.length === 0 && <p className={styles.empty}>No house formats yet.</p>}
      <p className={styles.status}>
        Choose a house format from the deck header. <Link to="/my-decks">My decks</Link>
      </p>
    </div>
  );
}
