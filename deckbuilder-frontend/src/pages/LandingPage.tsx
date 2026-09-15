import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { getDisplayName } from "../auth/userDisplay";
import styles from "./LandingPage.module.css";
import transitions from "../styles/pageTransitions.module.css";

export function LandingPage() {
  const { user } = useAuth();
  const displayName = getDisplayName(user);

  const guestPaths: Array<{
    to: string;
    mark: string;
    title: string;
    description: string;
    drawer?: boolean;
  }> = [
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
      title: "My",
      description: "Your decks and drawers.",
      drawer: true,
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
            ? `Welcome back, ${displayName}. Search the card pool or open your decks.`
            : "Search the full card pool, study public lists, and shape your next brew — all in one place."}
        </p>
      </div>

      <div className={styles.actions}>
        {paths.map((path, index) =>
          "drawer" in path && path.drawer ? (
            <div
              key={path.to}
              className={styles.myDrawer}
              style={{ animationDelay: `${80 + index * 70}ms` }}
            >
              <div className={styles.myDrawerFace} aria-hidden={false}>
                <span className={styles.cardMark} aria-hidden>
                  {path.mark}
                </span>
                <span className={styles.cardTitle}>{path.title}</span>
                <span className={styles.cardDesc}>{path.description}</span>
              </div>
              <div className={styles.myDrawerInner}>
                <Link to="/my-decks" className={styles.myDrawerSlot}>
                  <span className={styles.myDrawerSlotMark}>D</span>
                  <span className={styles.myDrawerSlotTitle}>Decks</span>
                </Link>
                <Link to="/drawers" className={styles.myDrawerSlot}>
                  <span className={styles.myDrawerSlotMark}>W</span>
                  <span className={styles.myDrawerSlotTitle}>Drawers</span>
                </Link>
              </div>
            </div>
          ) : (
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
            </Link>
          )
        )}
      </div>

      <p className={styles.footerHint}>
        {user ? (
          <>
            Signed in as{" "}
            <Link to="/login" className={styles.inlineLink}>
              {displayName}
            </Link>
          </>
        ) : (
          <>
            <Link to="/login" className={styles.inlineLink}>
              Log in
            </Link>{" "}
            to save decks and preferences.
          </>
        )}
      </p>
    </div>
  );
}
