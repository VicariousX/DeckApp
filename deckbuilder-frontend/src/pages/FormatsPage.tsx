import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  blankHouseFormat,
  loadHouseFormats,
  saveHouseFormats,
} from "../services/houseFormatService";
import type { HouseFormat } from "../lib/formats/rules";
import styles from "./MyDecksPage.module.css";

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

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Formats</h1>
          <p className={styles.subtitle}>
            Built-in formats are checked on the deck. House formats are yours for now.
            Public play-group rules come later.
          </p>
        </div>
      </header>

      <form
        className={styles.createCard}
        onSubmit={(e) => {
          e.preventDefault();
          saveDraft();
        }}
      >
        <h2 className={styles.createTitle}>{formats.some((f) => f.id === draft.id) ? "Edit format" : "New house format"}</h2>
        <div className={styles.createRow}>
          <input
            className={styles.input}
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder="Format name"
            required
          />
          <input
            className={styles.input}
            type="number"
            min={0}
            value={draft.deckSize ?? ""}
            onChange={(e) => setDraft({ ...draft, deckSize: e.target.value ? Number(e.target.value) : null })}
            placeholder="Deck size"
            aria-label="Deck size"
          />
          <input
            className={styles.input}
            type="number"
            min={1}
            value={draft.copyLimit}
            onChange={(e) => setDraft({ ...draft, copyLimit: Number(e.target.value) || 1 })}
            aria-label="Copy limit"
          />
          <button className={styles.primaryBtn} type="submit">Save</button>
        </div>
        <label className={styles.deckMeta}>
          <input
            type="checkbox"
            checked={draft.singleton}
            onChange={(e) => setDraft({ ...draft, singleton: e.target.checked })}
          />{" "}
          Singleton
        </label>
        <label className={styles.deckMeta}>
          <input
            type="checkbox"
            checked={draft.commanderRequired}
            onChange={(e) => setDraft({ ...draft, commanderRequired: e.target.checked })}
          />{" "}
          Commander required
        </label>
        <label className={styles.deckMeta}>
          <input
            type="checkbox"
            checked={draft.colorIdentity}
            onChange={(e) => setDraft({ ...draft, colorIdentity: e.target.checked })}
          />{" "}
          Color identity
        </label>
        <textarea
          className={styles.input}
          value={draft.banned.join("\n")}
          onChange={(e) => setDraft({ ...draft, banned: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })}
          placeholder="Banned cards, one per line"
          rows={4}
        />
        <textarea
          className={styles.input}
          value={draft.notes}
          onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
          placeholder="House notes"
          rows={3}
        />
      </form>

      <ul className={styles.list}>
        {formats.map((f) => (
          <li key={f.id} className={styles.deckItem}>
            <button type="button" className={styles.deckLink} onClick={() => setDraft(f)}>
              <span className={styles.deckName}>{f.name}</span>
              <span className={styles.deckMeta}>
                {f.deckSize || "any"} cards · {f.singleton ? "singleton" : `${f.copyLimit} copies`}
                {f.isPublic ? " · public" : " · private"}
              </span>
            </button>
            <button type="button" className={styles.deleteBtn} onClick={() => persist(formats.filter((x) => x.id !== f.id))}>
              Delete
            </button>
          </li>
        ))}
      </ul>
      {formats.length === 0 && <p className={styles.empty}>No house formats yet.</p>}
      <p className={styles.status}>
        Use a house format from the deck header. <Link to="/my-decks">My decks</Link>
      </p>
    </div>
  );
}
