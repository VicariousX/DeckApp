import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { getDisplayName } from "../auth/userDisplay";
import { fetchRandomCard } from "../lib/scryfallApi";
import { pushRandomHistory } from "../lib/randomCardHistory";
import { CardInspectorModal } from "../components/CardInspectorModal";
import type { ScryfallCard } from "../types/scryfallCard";
import styles from "./LandingPage.module.css";
import transitions from "../styles/pageTransitions.module.css";

const WELCOME_NOTES = [
  "Enjoy!",
  "Good hunting.",
  "Shuffle up.",
  "Make it spicy.",
  "Brew something weird.",
  "Trust the pile.",
  "Draw first.",
  "Have fun with it.",
  "Go again.",
  "Keep the spark.",
];

export function LandingPage() {
  const { user } = useAuth();
  const displayName = getDisplayName(user);
  const welcomeNote = useMemo(
    () => WELCOME_NOTES[Math.floor(Math.random() * WELCOME_NOTES.length)],
    []
  );
  const [randomModal, setRandomModal] = useState<ScryfallCard | null>(null);
  const [randomBusy, setRandomBusy] = useState(false);

  async function openRandom() {
    if (randomBusy) return;
    setRandomBusy(true);
    const { card } = await fetchRandomCard();
    setRandomBusy(false);
    if (card) {
      pushRandomHistory(user?.id, {
        id: card.id,
        name: card.name,
        image:
          card.image_uris?.normal ||
          card.card_faces?.[0]?.image_uris?.normal ||
          null,
      });
      setRandomModal(card);
    }
  }

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
          {user ? (
            <>
              Welcome back,{" "}
              <Link to="/login" className={styles.titleAccent}>
                {displayName}
              </Link>
              . {welcomeNote}
            </>
          ) : (
            "Search the full card pool, study public lists, and shape your next brew — all in one place."
          )}
        </p>
      </div>

      <section className={styles.searchPanel} aria-label="Search">
        <h2 className={styles.sectionTitle}>Search</h2>
        <div className={styles.modes}>
          <Link to="/search/simple" className={styles.mode}>
            <span className={styles.modeCopy}>
              <strong>Simple</strong>
              <span>Filters for color, type, and text</span>
            </span>
            <em className={styles.go} aria-hidden>→</em>
          </Link>
          <Link to="/search?mode=standard" className={styles.mode}>
            <span className={styles.modeCopy}>
              <strong>Standard</strong>
              <span>Look up a card by name</span>
            </span>
            <em className={styles.go} aria-hidden>→</em>
          </Link>
          <Link to="/search?mode=advanced" className={styles.mode}>
            <span className={styles.modeCopy}>
              <strong>Advanced</strong>
              <span>Write a Scryfall query</span>
            </span>
            <em className={styles.go} aria-hidden>→</em>
          </Link>
        </div>
        <button
          type="button"
          className={`${styles.random}${randomBusy ? ` ${styles.randomBusy}` : ""}`}
          onClick={() => void openRandom()}
          disabled={randomBusy}
        >
          <i className={styles.pip} aria-hidden />
          {randomBusy ? "Drawing…" : "Random card"}
        </button>
      </section>

      <div className={styles.split}>
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>My</h2>
          <Link to="/login" className={styles.lead}>
            {user ? "Profile" : "Log in"}
          </Link>
          <div className={styles.links}>
            <Link to="/my-decks" className={styles.link}>Decks</Link>
            <Link to="/drawers" className={styles.link}>Drawers</Link>
            <Link to="/collections" className={styles.link}>Collections</Link>
            <Link to="/combos" className={styles.link}>Combos</Link>
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Community</h2>
          <a href="https://discord.com/invite/placeholder" className={styles.lead} target="_blank" rel="noreferrer">
            Discord
          </a>
          <div className={styles.links}>
            <Link to="/social" className={styles.link}>Social</Link>
            <Link to="/formats" className={styles.link}>Formats</Link>
            <Link to="/decks" className={`${styles.link} ${styles.linkWide}`}>Public deck library</Link>
          </div>
        </section>
      </div>

      {!user && (
        <p className={styles.footerHint}>
          <Link to="/login" className={styles.inlineLink}>
            Log in
          </Link>{" "}
          to save decks and preferences.
        </p>
      )}

      {randomModal && (
        <CardInspectorModal
          scryfallId={randomModal.id}
          name={randomModal.name}
          imageUrl={
            randomModal.image_uris?.normal ||
            randomModal.card_faces?.[0]?.image_uris?.normal
          }
          onClose={() => setRandomModal(null)}
        />
      )}
    </div>
  );
}