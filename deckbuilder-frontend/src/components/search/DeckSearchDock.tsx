import { useEffect, useRef, useState } from "react";
import { CardSearch } from "../CardSearch";
import { AdvancedSearch } from "./AdvancedSearch";
import { SimpleSearchForm } from "./SimpleSearchForm";
import { SearchResultsPanel } from "./SearchResultsPanel";
import type { ScryfallCard } from "../../types/scryfallCard";
import { useIsMobile } from "../../hooks/useIsMobile";
import { BottomSheet } from "../BottomSheet";
import styles from "./DeckSearchDock.module.css";

export type SearchKind = "simple" | "standard" | "advanced";

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
    title: query || (mode === "advanced" ? "Advanced" : mode === "standard" ? "Standard" : "Simple"),
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
      {open ? "Close" : "Search"}
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
  const [tabs, setTabs] = useState<Tab[]>([newTab("simple")]);
  const [pinOpen, setPinOpen] = useState(true);
  const [activeId, setActiveId] = useState(tabs[0].id);
  const [modeFor, setModeFor] = useState<string | null>(null);
  const active = tabs.find((t) => t.id === activeId) ?? tabs[0];
  const resultsRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!modeFor) return;
    function onDoc(e: PointerEvent) {
      if (!tabsRef.current?.contains(e.target as Node)) setModeFor(null);
    }
    document.addEventListener("pointerdown", onDoc);
    return () => document.removeEventListener("pointerdown", onDoc);
  }, [modeFor]);

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
              title: t.query ? t.title : mode === "advanced" ? "Advanced" : mode === "standard" ? "Standard" : "Simple",
            }
          : t
      )
    );
    setModeFor(null);
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
      <div className={`${styles.tabs} ${isMobile ? styles.tabsSticky : ""}`} ref={tabsRef}>
        {tabs.map((t) => (
          <div key={t.id} className={styles.tabWrap}>
            <button
              type="button"
              className={`${styles.tab}${t.id === active.id ? ` ${styles.tabOn}` : ""}`}
              onClick={() => {
                if (t.id !== active.id) {
                  setActiveId(t.id);
                  setModeFor(null);
                  return;
                }
                setModeFor((cur) => (cur === t.id ? null : t.id));
              }}
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
                      return next.length ? next : [newTab("simple")];
                    });
                    setModeFor(null);
                  }}
                >
                  ×
                </span>
              )}
            </button>
            {modeFor === t.id && (
              <ul className={`${styles.menu} ${styles.tabMenu}`} role="menu">
                {(["simple", "standard", "advanced"] as const).map((m) => (
                  <li key={m}>
                    <button
                      type="button"
                      role="menuitemradio"
                      aria-checked={m === t.mode}
                      className={m === t.mode ? styles.menuOn : undefined}
                      onClick={() => setActiveMode(m)}
                    >
                      {m === "advanced" ? "Advanced" : m === "standard" ? "Standard" : "Simple"}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
        <button
          type="button"
          className={styles.tabAdd}
          onClick={() => {
            const t = newTab(active.mode);
            setTabs((list) => [...list, t]);
            setActiveId(t.id);
            setModeFor(null);
          }}
        >
          +
        </button>
      </div>
  );

  const searchBody = (
    <>
      {active.mode === "advanced" ? (
        <AdvancedSearch
          compact
          initialQuery={active.query}
          pinHost={isMobile ? pinHost : null}
          inDeck
          commanderIdentity={seedQuery}
          onSearch={(q) => runQuery(q, "advanced")}
        />
      ) : active.mode === "standard" ? (
        <CardSearch
          compact
          mode="standard"
          inDeck
          commanderIdentity={seedQuery}
          onSearch={(q) => runQuery(q, "standard")}
        />
      ) : (
        <SimpleSearchForm
          commanderIdentity={seedQuery}
          onSearch={(q) => runQuery(q, "simple")}
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
        <button type="button" className={styles.pinToggle} onClick={() => setPinOpen((v) => !v)}>
          {pinOpen ? "Hide search" : "Show search"}
        </button>
        {pinOpen && (
          <>
            {tabBar}
            <div ref={setPinHost} />
          </>
        )}
      </div>
      <div className={styles.sheetScroll}>{searchBody}</div>
    </div>
  ) : (
    <>
      {tabBar}
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
