import { useEffect, useRef, useState } from "react";
import { CardSearch } from "../CardSearch";
import { AdvancedSearch } from "./AdvancedSearch";
import { SearchResultsPanel } from "./SearchResultsPanel";
import type { ScryfallCard } from "../../types/scryfallCard";
import { useIsMobile } from "../../hooks/useIsMobile";
import { BottomSheet } from "../BottomSheet";
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
      className={`${styles.cycleBtn} ${styles.searchOpenBtn}`}
      onClick={onToggle}
    >
      {open ? "Close search" : "Open search"}
    </button>
  );
}

export function DeckSearchDock({
  open,
  onAddCard,
  onClose,
  countInDeck,
  onUndoAdd,
  seedQuery,
}: {
  open: boolean;
  onAddCard?: (card: ScryfallCard) => void;
  /** Called when the user closes the dock (required for mobile bottom sheet). */
  onClose?: () => void;
  countInDeck?: (card: ScryfallCard) => number;
  onUndoAdd?: (card: ScryfallCard) => void;
  /** Prefill for formats that care about color identity. */
  seedQuery?: string;
}) {
  const isMobile = useIsMobile();
  const [pinHost, setPinHost] = useState<HTMLDivElement | null>(null);
  const [tabs, setTabs] = useState<Tab[]>([newTab("advanced")]);
  const [identityOn, setIdentityOn] = useState(false);
  const [identityNonce, setIdentityNonce] = useState(0);
  const [activeId, setActiveId] = useState(tabs[0].id);
  const [modeMenu, setModeMenu] = useState(false);
  const active = tabs.find((t) => t.id === activeId) ?? tabs[0];
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active.query) return;
    const t = window.setTimeout(() => {
      resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
    return () => window.clearTimeout(t);
  }, [active.query]);

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

  const tabBar = (
      <div className={`${styles.tabs} ${isMobile ? styles.tabsSticky : ""}`}>
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
                    return next.length ? next : [newTab("advanced")];
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
  );

  const searchBody = (
    <>
      {active.mode === "advanced" ? (
        <AdvancedSearch
          compact
          initialQuery={active.query}
          pinHost={isMobile ? pinHost : null}
          identityToken={identityOn ? seedQuery : undefined}
          identityNonce={identityNonce}
          onSearch={(q) => runQuery(q, "advanced")}
        />
      ) : (
        <CardSearch
          compact
          mode="standard"
          extraQuery={identityOn ? seedQuery : undefined}
          onSearch={(q) => runQuery(q, "standard")}
        />
      )}
      {active.query && (
        <div ref={resultsRef}>
          <SearchResultsPanel
            query={active.query}
            onAddToDeck={onAddCard}
            countInDeck={countInDeck}
            onUndoAdd={onUndoAdd}
          />
        </div>
      )}
    </>
  );

  const content = isMobile ? (
    <div className={styles.sheetCol}>
      <div className={styles.sheetPinned}>
        {tabBar}
        <div ref={setPinHost} />
        {seedQuery && (
          <button
            type="button"
            className={styles.identityBtn}
            onClick={() => {
              setIdentityOn(true);
              setIdentityNonce((n) => n + 1);
            }}
          >
            {identityOn ? "Commander ID applied" : "Apply commander ID"}
          </button>
        )}
      </div>
      <div className={styles.sheetScroll}>{searchBody}</div>
    </div>
  ) : (
    <>
      {tabBar}
      {seedQuery && (
        <button
          type="button"
          className={styles.identityBtn}
          onClick={() => {
            setIdentityOn(true);
            setIdentityNonce((n) => n + 1);
          }}
        >
          {identityOn ? "Commander ID applied" : "Apply commander ID"}
        </button>
      )}
      {searchBody}
    </>
  );

  if (isMobile) {
    return (
      <BottomSheet open onClose={() => onClose?.()} title="Search" bodyClassName={styles.sheetBody}>
        {content}
      </BottomSheet>
    );
  }

  return <div className={styles.dock}>{content}</div>;
}
