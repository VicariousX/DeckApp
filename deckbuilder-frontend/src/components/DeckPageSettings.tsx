import { useSyncExternalStore } from "react";
import { Link } from "react-router-dom";
import {
  getDeckPageControls,
  subscribeDeckPageControls,
  type DeckGroupMode,
} from "../lib/deckPageControls";
import type { CardSortKey } from "../lib/deckPreferences";
import { getDeckScrollText, onDeckScrollText, setDeckScrollText } from "../lib/deckScrollPreference";
import { useIsMobile } from "../hooks/useIsMobile";
import { useEffect, useState } from "react";
import { CardSizeSlider } from "./CardSizeSlider";
import styles from "./SettingsDrawer.module.css";

const GROUPS: [DeckGroupMode, string][] = [
  ["type", "Type"],
  ["tag", "Tags"],
  ["none", "List"],
  ["grid", "Grid"],
];

const SORTS: [CardSortKey, string][] = [
  ["default", "Default"],
  ["name", "Name"],
  ["cmc", "Mana value"],
  ["type", "Type"],
  ["qty", "Quantity"],
];

export function DeckPageSettings() {
  const controls = useSyncExternalStore(subscribeDeckPageControls, getDeckPageControls, getDeckPageControls);
  const narrow = useIsMobile(900);
  const [textScroll, setTextScroll] = useState(getDeckScrollText);
  const [historyOpen, setHistoryOpen] = useState(false);
  useEffect(() => onDeckScrollText(() => setTextScroll(getDeckScrollText())), []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>
      <CardSizeSlider sizeKey="deck" />
      <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: "0.88rem" }}>
        <input
          type="checkbox"
          checked={textScroll}
          onChange={(e) => setDeckScrollText(e.target.checked)}
          style={{ marginTop: 3 }}
        />
        <span>Scroll view shows oracle text and stats instead of the card image.</span>
      </label>
      {controls && (
        <>
          {narrow && (
          <div>
            <div className={styles.sectionTitle}>Arrange</div>
            <div className={styles.pills} style={{ flexWrap: "wrap" }}>
              {GROUPS.filter(([mode]) => controls.viewMode === "image" || mode !== "grid").map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  className={`${styles.pill}${controls.groupMode === mode ? ` ${styles.pillOn}` : ""}`}
                  onClick={() => controls.setGroup(mode)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          )}
          {narrow && (
          <div className={styles.row}>
            <span>Sort</span>
            <span className={styles.pills}>
              <select
                aria-label="Sort"
                value={controls.cardSort}
                onChange={(e) => controls.setSort(e.target.value as CardSortKey)}
                style={{ border: "none", background: "transparent", color: "inherit", font: "inherit", padding: "4px 8px" }}
              >
                {SORTS.map(([id, label]) => (
                  <option key={id} value={id}>{label}</option>
                ))}
              </select>
              <button
                type="button"
                className={`${styles.pill} ${styles.pillOn}`}
                onClick={() => controls.setDir(controls.sortDir === "asc" ? "desc" : "asc")}
              >
                {controls.sortDir === "asc" ? "Asc" : "Desc"}
              </button>
            </span>
          </div>
          )}
          {controls.isOwner && controls.formats.length > 0 && (
            <div className={styles.row}>
              <span>Format</span>
              <select
                aria-label="Format"
                value={controls.formatId}
                onChange={(e) => controls.setFormat(e.target.value)}
                style={{ border: "1px solid var(--color-border)", background: "transparent", color: "inherit", font: "inherit", borderRadius: 8, padding: "4px 8px" }}
              >
                {controls.formats.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>
          )}
          {controls.tools ? (
            <div>
              <div className={styles.sectionTitle}>Tools</div>
              {controls.tools}
            </div>
          ) : null}
          <div>
            <div className={styles.sectionTitle}>Deck</div>
            <div className={styles.pills} style={{ flexWrap: "wrap" }}>
              {controls.canCopy && (
                <>
                  <button type="button" className={styles.pill} onClick={controls.onClone}>Clone</button>
                  <button type="button" className={styles.pill} onClick={controls.onBranches}>Branches</button>
                </>
              )}
              {controls.isOwner && (
                <button type="button" className={styles.pill} onClick={() => setHistoryOpen((v) => !v)}>
                  History
                </button>
              )}
              {controls.isOwner && (
                <button type="button" className={styles.pill} onClick={controls.onTogglePublic}>
                  {controls.isPublic ? "Public" : "Make public"}
                </button>
              )}
              {controls.parentId && (
                <Link to={`/deck/${controls.parentId}`} className={styles.pill}>Parent</Link>
              )}
            </div>
            {historyOpen && (
              <ul style={{ margin: "0.55rem 0 0", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                {controls.history.length === 0 && <li style={{ color: "var(--color-text-muted)", fontSize: "0.82rem" }}>No saved edits yet.</li>}
                {controls.history.map((snap) => (
                  <li key={snap.at} style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem", fontSize: "0.82rem" }}>
                    <span>{new Date(snap.at).toLocaleString()} · {snap.label}</span>
                    <button type="button" className={styles.pill} onClick={() => controls.onRestore(snap.at)}>Restore</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
