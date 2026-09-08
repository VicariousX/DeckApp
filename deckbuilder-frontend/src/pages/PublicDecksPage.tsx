import { Link } from "react-router-dom";
import styles from "./PlaceholderPage.module.css";
import transitions from "../styles/pageTransitions.module.css";

export function PublicDecksPage() {
  return (
    <div className={`${styles.wrap} ${transitions.page}`}>
      <span className={styles.badge}>Coming soon</span>
      <h1 className={styles.title}>Public decks</h1>
      <p className={styles.body}>
        A browsable gallery of community decks will appear here. Placeholder
        for now while we lock in the overall UX shell.
      </p>
      <Link to="/" className={styles.homeLink}>
        \u2190 Back to home
      </Link>
    </div>
  );
}
