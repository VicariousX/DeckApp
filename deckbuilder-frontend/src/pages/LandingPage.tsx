import { Link } from "react-router-dom";
import styles from "./LandingPage.module.css";
import transitions from "../styles/pageTransitions.module.css";

const paths = [
  {
    to: "/search",
    icon: "\ud83d\udd0d",
    title: "Search cards",
    description: "Look up any Magic card by name and explore printings.",
  },
  {
    to: "/login",
    icon: "\ud83d\udc64",
    title: "Log in",
    description: "Sign in to save decks and sync your collection.",
  },
  {
    to: "/decks",
    icon: "\ud83d\udcda",
    title: "Public decks",
    description: "Browse decks shared by the community.",
  },
];

export function LandingPage() {
  return (
    <div className={`${styles.landing} ${transitions.landingEnter}`}>
      <div className={styles.hero}>
        <p className={styles.eyebrow}>DeckApp</p>
        <h1 className={styles.title}>Build better Magic decks</h1>
        <p className={styles.subtitle}>
          Search the full card pool, study public lists, and shape your next
          brew \u2014 all in one place.
        </p>
      </div>

      <div className={styles.actions}>
        {paths.map((path) => (
          <Link key={path.to} to={path.to} className={styles.card}>
            <span className={styles.cardIcon} aria-hidden>
              {path.icon}
            </span>
            <span className={styles.cardTitle}>{path.title}</span>
            <span className={styles.cardDesc}>{path.description}</span>
          </Link>
        ))}
      </div>

      <p className={styles.footer}>Premium theme \u00b7 local Scryfall symbols</p>
    </div>
  );
}
