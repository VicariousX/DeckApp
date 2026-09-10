import { Link } from "react-router-dom";
import styles from "./PlaceholderPage.module.css";
import transitions from "../styles/pageTransitions.module.css";

export function MyDecksPage() {
  return (
    <div className={`${styles.wrap} ${transitions.page}`}>
      <span className={styles.badge}>Coming soon</span>
      <h1 className={styles.title}>My decks</h1>
      <p className={styles.body}>
        Your personal decks will live here. Create, edit, and publish them once
        deck storage is wired to Supabase.
      </p>
      <Link to="/decks" className={styles.homeLink}>
        Browse public decks →
      </Link>
      <Link to="/" className={styles.homeLink}>
        ← Back to home
      </Link>
    </div>
  );
}
