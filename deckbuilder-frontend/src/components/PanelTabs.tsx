import styles from "../pages/DeckBuilderPage.module.css";

export type PanelTab = "deck" | "stats" | "tokens" | "tags";

type Props = {
  tabs: { id: PanelTab; label: string }[];
  active: PanelTab;
  tagCount: number;
  onChange: (tab: PanelTab) => void;
};

export function PanelTabs({ tabs, active, tagCount, onChange }: Props) {
  return (
    <div className={styles.boardTabs} role="tablist" aria-label="Panel">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={active === t.id}
          className={active === t.id ? `${styles.boardTab} ${styles.boardTabActive}` : styles.boardTab}
          onClick={() => onChange(t.id)}
        >
          {t.label}
          {t.id === "tags" && tagCount > 0 && (
            <span className={styles.boardTabCount}>{tagCount}</span>
          )}
        </button>
      ))}
    </div>
  );
}
