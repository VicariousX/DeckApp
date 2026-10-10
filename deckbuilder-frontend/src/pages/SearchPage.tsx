import { Link, useSearchParams } from "react-router-dom";
import { CardSearch } from "../components/CardSearch";
import { AdvancedSearch } from "../components/search/AdvancedSearch";
import transitions from "../styles/pageTransitions.module.css";
import styles from "./SearchPage.module.css";

export function SearchPage() {
  const [params] = useSearchParams();
  const mode = params.get("mode") === "advanced" ? "advanced" : "standard";

  return (
    <div className={`${transitions.page} ${styles.page}`}>
      <header className={styles.header}>
        <div>
          <h1>Search</h1>
          <p>{mode === "advanced" ? "Build a Scryfall query with tokens." : "Look up a card by name."}</p>
        </div>
        <div className={styles.modes} role="tablist" aria-label="Search mode">
          <Link to="/search?mode=standard" className={mode === "standard" ? styles.modeOn : styles.mode}>Standard</Link>
          <Link to="/search?mode=advanced" className={mode === "advanced" ? styles.modeOn : styles.mode}>Advanced</Link>
        </div>
      </header>
      {mode === "advanced" ? (
        <AdvancedSearch initialQuery={params.get("q") ?? ""} />
      ) : (
        <CardSearch mode="standard" />
      )}
    </div>
  );
}
