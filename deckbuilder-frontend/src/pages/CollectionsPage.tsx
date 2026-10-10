import { Link } from "react-router-dom";
import styles from "./FormatsPage.module.css";

export function CollectionsPage() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Collections</h1>
          <p className={styles.subtitle}>
            Owned printings, missing cards, and rough prices will live here.
            The art picker already remembers a preferred printing per card.
          </p>
        </div>
      </header>
      <p className={styles.status}>
        Nothing to mark owned yet. <Link to="/search">Search a card</Link> to set preferred art.
      </p>
    </div>
  );
}
