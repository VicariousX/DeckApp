import { useState } from "react";
import { CardSearch } from "../CardSearch";
import { AdvancedSearch } from "./AdvancedSearch";
import { SearchResultsPanel } from "./SearchResultsPanel";
import type { ScryfallCard } from "../../types/scryfallCard";
import styles from "./DeckSearchDock.module.css";

export type AddSearchMode = "quick" | "standard" | "advanced";

type Tab = {
  id: string;
  mode: "standard" | "advanced";
  query: string;
  title: string;
};

const MODES: { id: AddSearchMode; label: string }[] = [
  { id: "quick", label: "Quick add" },
  { id: "standard", label: "Standard" },
  { id: "advanced", label: "Advanced" },
];

function newTab(mode: "standard" | "advanced", query = ""): Tab {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    mode,
    query,
    title: query || (mode === "advanced" ? "Advanced" : "Standard"),
  };
}

export function DeckSearchModeToggle({
  mode,
  onMode,
}: {
  mode: AddSearchMode;
  onMode: (m: AddSearchMode) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  function cycle() {
    const i = MODES.findIndex((m) => m.id === mode);
    onMode(MODES[(i + 1) % MODES.length].id);
    setMenuOpen(false);
  }
  return (
    <div className={styles.cycleWrap}>
      <button
        type="button"
        className={styles.cycleBtn}
        title="Click to cycle. Right-click to choose."
        onClick={cycle}
        onContextMenu={(e) => {
          e.preventDefault();
          setMenuOpen((v) => !v);
        }}
      >
        {MODES.find((m) => m.id === mode)?.label ?? "Quick add"}
      </button>
      {menuOpen && (
        <ul className={styles.menu} role="menu">
          {MODES.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                className={m.id === mode ? styles.menuOn : undefined}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onMode(m.id);
                  setMenuOpen(false);
                }}
              >
                {m.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function DeckSearchDock({
  mode,
  onAddCard,
}: {
  mode: AddSearchMode;
  onAddCard: (card: ScryfallCard) => void;
}) {
  const [tabs, setTabs] = useState<Tab[]>([newTab(mode === "advanced" ? "advanced" : "standard")]);
  const [activeId, setActiveId] = useState(tabs[0].id);
  const active = tabs.find((t) => t.id === activeId) ?? tabs[0];

  if (mode === "quick") return null;

  function runQuery(q: string, tabMode: "standard" | "advanced") {
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
                    return next.length
                      ? next
                      : [newTab(mode === "advanced" ? "advanced" : "standard")];
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
            const t = newTab(mode === "advanced" ? "advanced" : "standard");
            setTabs((list) => [...list, t]);
            setActiveId(t.id);
          }}
        >
          +
        </button>
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
