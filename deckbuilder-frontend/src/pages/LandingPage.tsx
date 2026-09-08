import { Link } from "react-router-dom";
import styles from "./LandingPage.module.css";
import transitions from "../styles/pageTransitions.module.css";

const paths = [
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

export function LandingPage() {
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
          Search the full card pool, study public lists, and shape your next
          brew \u2014 all in one place.
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
            <span className={styles.cardCta}>Open \u2192</span>
          </Link>
        ))}
      </div>

      <p className={styles.footer}>Premium theme \u00b7 local Scryfall symbols</p>
    </div>
  );
}
