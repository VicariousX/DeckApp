import { useEffect, useRef, useState } from "react";
import { useTheme } from "../theme/ThemeProvider";
import {
  THEME_GROUPS,
  themesInGroup,
  type AppThemeId,
} from "../theme/themes";
import styles from "./ThemePicker.module.css";

export function ThemePicker() {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const current =
    themesInGroup("signature")
      .concat(themesInGroup("realm"), themesInGroup("guild"))
      .find((t) => t.id === theme) ?? null;

  return (
    <div className={styles.wrap} ref={ref}>
      <button
        type="button"
        className={styles.trigger}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        title="Theme"
      >
        <span
          className={styles.swatch}
          style={{ background: current?.swatch ?? "var(--color-accent)" }}
          aria-hidden
        />
        <span className={styles.triggerLabel}>{current?.label ?? "Theme"}</span>
      </button>
      {open && (
        <div className={styles.panel} role="listbox" aria-label="Themes">
          {THEME_GROUPS.map((g) => (
            <div key={g.id} className={styles.group}>
              <div className={styles.groupLabel}>{g.label}</div>
              <div className={styles.grid}>
                {themesInGroup(g.id).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    role="option"
                    aria-selected={theme === t.id}
                    className={`${styles.option}${
                      theme === t.id ? ` ${styles.optionActive}` : ""
                    }`}
                    onClick={() => {
                      setTheme(t.id as AppThemeId);
                      setOpen(false);
                    }}
                  >
                    <span
                      className={styles.optionSwatch}
                      style={{ background: t.swatch }}
                    />
                    <span className={styles.optionText}>
                      <span className={styles.optionName}>{t.label}</span>
                      <span className={styles.optionBlurb}>{t.blurb}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
