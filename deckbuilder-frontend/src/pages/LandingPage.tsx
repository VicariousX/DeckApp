import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { getDisplayName } from "../auth/userDisplay";
import { useTheme, type AppTheme } from "../theme/ThemeProvider";
import styles from "./LandingPage.module.css";
import transitions from "../styles/pageTransitions.module.css";

export function LandingPage() {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const displayName = getDisplayName(user);

  const guestPaths = [
    {
      to: "/search",
      mark: "S",
      title: "Search cards",
      description: "Look up any Magic card by name and explore printings.",
    },
    {
      to: "/login",
      mark: "L",
      title: "Log in",
      description: "Sign in to save decks and sync your collection.",
    },
    {
      to: "/decks",
      mark: "D",
      title: "Public decks",
      description: "Browse decks shared by the community.",
    },
  ];

  const userPaths = [
    {
      to: "/search",
      mark: "S",
      title: "Search cards",
      description: "Look up any Magic card by name and explore printings.",
    },
    {
      to: "/my-decks",
      mark: "M",
      title: "My decks",
      description: "Open your personal deck lists and drafts.",
    },
    {
      to: "/decks",
      mark: "D",
      title: "Public decks",
      description: "Browse decks shared by the community.",
    },
  ];

  const paths = user ? userPaths : guestPaths;

  return (
    <div className={`${styles.landing} ${transitions.landingEnter}`}>
      <div className={styles.glow} aria-hidden />

      <div className={styles.hero}>
        <p className={styles.eyebrow}>DeckApp</p>
        <h1 className={styles.title}>
          Build better
          <span className={styles.titleAccent}> Magic </span>
          decks
        </h1>
        <p className={styles.subtitle}>
          {user
            ? `Welcome back, ${displayName}. Search the card pool, manage your decks, or update your account.`
            : "Search the full card pool, study public lists, and shape your next brew — all in one place."}
        </p>
      </div>

      <div className={styles.actions}>
        {paths.map((path, index) => (
          <Link
            key={path.to}
            to={path.to}
            className={styles.card}
            style={{ animationDelay: `${80 + index * 70}ms` }}
          >
            <span className={styles.cardMark} aria-hidden>
              {path.mark}
            </span>
            <span className={styles.cardTitle}>{path.title}</span>
            <span className={styles.cardDesc}>{path.description}</span>
            <span className={styles.cardCta}>Open →</span>
          </Link>
        ))}
      </div>

      {user && (
        <div className={styles.accountPanel}>
          <div className={styles.accountPanelHeader}>
            <div>
              <p className={styles.accountPanelLabel}>Account</p>
              <p className={styles.accountPanelName}>{displayName}</p>
              {user.email && (
                <p className={styles.accountPanelEmail}>{user.email}</p>
              )}
            </div>
            <Link to="/login" className={styles.accountPanelLink}>
              Manage profile →
            </Link>
          </div>

          <div className={styles.themeBar} role="group" aria-label="Theme">
            <span className={styles.themeLabel}>Theme</span>
            <button
              type="button"
              className={`${styles.themeBtn} ${
                theme === "premium" ? styles.themeBtnActive : ""
              }`}
              onClick={() => setTheme("premium" as AppTheme)}
            >
              Premium
            </button>
            <button
              type="button"
              className={`${styles.themeBtn} ${
                theme === "arcane" ? styles.themeBtnActive : ""
              }`}
              onClick={() => setTheme("arcane" as AppTheme)}
            >
              Arcane
            </button>
          </div>
        </div>
      )}

      <p className={styles.footer}>
        {theme === "arcane" ? "Arcane" : "Premium"} theme · local Scryfall
        symbols
      </p>
    </div>
  );
}
