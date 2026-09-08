import { Link } from "react-router-dom";
import styles from "./PlaceholderPage.module.css";
import transitions from "../styles/pageTransitions.module.css";

export function LoginPage() {
  return (
    <div className={`${styles.wrap} ${transitions.page}`}>
      <span className={styles.badge}>Coming soon</span>
      <h1 className={styles.title}>Log in</h1>
      <p className={styles.body}>
        Account sign-in will live here. For now this is a placeholder so
        routing and transitions can be wired end to end.
      </p>
      <Link to="/" className={styles.homeLink}>
        \u2190 Back to home
      </Link>
    </div>
  );
}
