import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { isAppTheme, type AppThemeId, THEME_IDS } from "./themes";

const STORAGE_KEY = "deckapp-theme";

type ThemeContextValue = {
  theme: AppThemeId;
  setTheme: (theme: AppThemeId) => void;
  /** Cycles signature themes only (legacy helper). */
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readStoredTheme(): AppThemeId {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (isAppTheme(v)) return v;
  } catch {
    /* ignore */
  }
  return "premium";
}

function applyTheme(theme: AppThemeId) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  // Clear legacy classnames
  for (const id of THEME_IDS) {
    root.classList.remove(`theme-${id}`);
  }
  root.classList.add(`theme-${theme}`);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<AppThemeId>(() => {
    if (typeof document !== "undefined") {
      const initial = readStoredTheme();
      applyTheme(initial);
      return initial;
    }
    return "premium";
  });

  useEffect(() => {
    applyTheme(theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  const setTheme = useCallback((next: AppThemeId) => {
    setThemeState(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((t) => (t === "premium" ? "arcane" : "premium"));
  }, []);

  const value = useMemo(
    () => ({ theme, setTheme, toggleTheme }),
    [theme, setTheme, toggleTheme]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
}
