import { useState } from "react";
import { CardSearch } from "../CardSearch";
import { AdvancedSearch } from "./AdvancedSearch";
import { SearchResultsPanel } from "./SearchResultsPanel";
import type { ScryfallCard } from "../../types/scryfallCard";
import styles from "./DeckSearchDock.module.css";

export type SearchKind = "standard" | "advanced";

type Tab = {
  id: string;
  mode: SearchKind;
  query: string;
  title: string;
};

function newTab(mode: SearchKind, query = ""): Tab {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    mode,
    query,
    title: query || (mode === "advanced" ? "Advanced" : "Standard"),
  };
}

export function DeckSearchToggle({
  open,
  onToggle,
}: {
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className={styles.cycleBtn}
      onClick={onToggle}
    >
      {open ? "Close search" : "Open search"}
    </button>
  );
}

export function DeckSearchDock({
  open,
  onAddCard,
}: {
  open: boolean;
  onAddCard?: (card: ScryfallCard) => void;
}) {
  const [tabs, setTabs] = useState<Tab[]>([newTab("standard")]);
  const [activeId, setActiveId] = useState(tabs[0].id);
  const [modeMenu, setModeMenu] = useState(false);
  const active = tabs.find((t) => t.id === activeId) ?? tabs[0];

  if (!open) return null;

  function setActiveMode(mode: SearchKind) {
    setTabs((list) =>
      list.map((t) =>
        t.id === active.id
          ? {
              ...t,
              mode,
              title: t.query ? t.title : mode === "advanced" ? "Advanced" : "Standard",
            }
          : t
      )
    );
    setModeMenu(false);
  }

  function runQuery(q: string, tabMode: SearchKind) {
    const trimmed = q.trim();
    if (!trimmed) return;
    setTabs((list) =>
      list.map((t) =>
        t.id === active.id
          ? { ...t, query: trimmed, mode: tabMode, title: trimmed.slice(0, 28) }
          : t
      )
    );
  }

  return (
    <div className={styles.dock}>
      <div className={styles.tabs}>
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`${styles.tab}${t.id === active.id ? ` ${styles.tabOn}` : ""}`}
            onClick={() => setActiveId(t.id)}
          >
            {t.title}
            {tabs.length > 1 && (
              <span
                className={styles.tabClose}
                onClick={(e) => {
                  e.stopPropagation();
                  setTabs((list) => {
                    const next = list.filter((x) => x.id !== t.id);
                    if (activeId === t.id) setActiveId(next[0]?.id ?? "");
                    return next.length ? next : [newTab("standard")];
                  });
                }}
              >
                ×
              </span>
            )}
          </button>
        ))}
        <button
          type="button"
          className={styles.tabAdd}
          onClick={() => {
            const t = newTab(active.mode);
            setTabs((list) => [...list, t]);
            setActiveId(t.id);
          }}
        >
          +
        </button>
        <div className={styles.cycleWrap}>
          <button
            type="button"
            className={styles.tabMode}
            title="Click to cycle. Right-click to choose."
            onClick={() =>
              setActiveMode(active.mode === "advanced" ? "standard" : "advanced")
            }
            onContextMenu={(e) => {
              e.preventDefault();
              setModeMenu((v) => !v);
            }}
          >
            {active.mode === "advanced" ? "Advanced" : "Standard"}
          </button>
          {modeMenu && (
            <ul className={styles.menu} role="menu">
              {(["standard", "advanced"] as const).map((m) => (
                <li key={m}>
                  <button
                    type="button"
                    className={m === active.mode ? styles.menuOn : undefined}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setActiveMode(m)}
                  >
                    {m === "advanced" ? "Advanced" : "Standard"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {active.mode === "advanced" ? (
        <AdvancedSearch
          compact
          initialQuery={active.query}
          onSearch={(q) => runQuery(q, "advanced")}
        />
      ) : (
        <CardSearch
          compact
          mode="standard"
          onSearch={(q) => runQuery(q, "standard")}
        />
      )}
      {active.query && (
        <SearchResultsPanel query={active.query} onAddToDeck={onAddCard} />
      )}
    </div>
  );
}
