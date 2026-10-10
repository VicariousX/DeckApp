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
          </p>
        </div>
      </header>
      <section className={styles.form}>
        <h2 className={styles.formTitle}>What you can do now</h2>
        <p className={styles.status}>Preferred art is already saved per card.</p>
        <div className={styles.actions}>
          <Link to="/search" className={styles.primaryBtn}>Search cards</Link>
          <Link to="/my-decks" className={styles.primaryBtn}>Open decks</Link>
        </div>
      </section>
    </div>
  );
}