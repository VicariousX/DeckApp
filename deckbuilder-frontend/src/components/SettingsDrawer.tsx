import { useEffect, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { useTheme } from "../theme/ThemeProvider";
import { THEMES, type AppThemeId } from "../theme/themes";
import { readCatalogTier, writeCatalogTier } from "../lib/catalog/preference";
import type { CatalogTier } from "../lib/catalog/types";
import styles from "./SettingsDrawer.module.css";

type SettingsSection = {
  title: string;
  content: ReactNode;
};

type SettingsContributor = (pathname: string) => SettingsSection | null;

const contributors: SettingsContributor[] = [];

export function registerSettings(fn: SettingsContributor) {
  contributors.push(fn);
}

export function SettingsButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className={styles.trigger} onClick={onClick} aria-label="Settings">
      ⋯
    </button>
  );
}

export function SettingsDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const location = useLocation();
  const { theme, setTheme } = useTheme();
  const [catalogTier, setCatalogTier] = useState<CatalogTier>(() => readCatalogTier());

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  function setTier(tier: CatalogTier) {
    setCatalogTier(tier);
    writeCatalogTier(tier);
  }

  const pageSections = contributors
    .map((fn) => fn(location.pathname))
    .filter((s): s is SettingsSection => s !== null);

  return (
    <>
      <div className={`${styles.backdrop}${open ? ` ${styles.backdropOn}` : ""}`} onClick={onClose} />
      <aside className={`${styles.drawer}${open ? ` ${styles.drawerOn}` : ""}`} aria-hidden={!open}>
        <header className={styles.header}>
          <h2 className={styles.title}>Settings</h2>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <div className={styles.body}>
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Appearance</h3>
            <div className={styles.swatches}>
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`${styles.swatch}${theme === t.id ? ` ${styles.swatchOn}` : ""}`}
                  style={{ background: t.swatch }}
                  title={t.label}
                  onClick={() => setTheme(t.id as AppThemeId)}
                />
              ))}
            </div>
          </section>
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Catalog</h3>
            <div className={styles.row}>
              <span>Tier</span>
              <span className={styles.pills}>
                {(["live", "core"] as const).map((tier) => (
                  <button
                    key={tier}
                    type="button"
                    className={`${styles.pill}${catalogTier === tier ? ` ${styles.pillOn}` : ""}`}
                    onClick={() => setTier(tier)}
                  >
                    {tier}
                  </button>
                ))}
              </span>
            </div>
          </section>
          {pageSections.map((s) => (
            <section key={s.title} className={styles.section}>
              <h3 className={styles.sectionTitle}>{s.title}</h3>
              {s.content}
            </section>
          ))}
        </div>
      </aside>
    </>
  );
}
