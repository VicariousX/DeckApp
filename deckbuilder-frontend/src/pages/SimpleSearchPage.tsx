import { Link } from "react-router-dom";
import styles from "./LoginPage.module.css";

/**
 * Placeholder for Simple search mode.
 * Will become a streamlined search with fewer controls than Standard.
 */
export function SimpleSearchPage() {
  return (
    <div className={styles.accountContent} style={{ maxWidth: 640, margin: "2rem auto", textAlign: "center" }}>
      <h1 className={styles.title}>Simple search</h1>
      <p className={styles.subtitle}>
        A streamlined search with fewer controls. Coming next.
      </p>
      <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 16 }}>
        <Link to="/search?mode=standard" className={styles.primaryBtn} style={{ width: "auto", display: "inline-block", textDecoration: "none" }}>
          Use Standard
        </Link>
        <Link to="/search?mode=advanced" className={styles.secondaryBtn} style={{ width: "auto", display: "inline-block", textDecoration: "none" }}>
          Use Advanced
        </Link>
      </div>
    </div>
  );
}
