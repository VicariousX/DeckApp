import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { getDisplayName } from "../auth/userDisplay";
import { fetchRandomCard } from "../lib/scryfallApi";
import { CardInspectorModal } from "../components/CardInspectorModal";
import type { ScryfallCard } from "../types/scryfallCard";
import styles from "./LandingPage.module.css";
import transitions from "../styles/pageTransitions.module.css";

type Rail =
  | { kind: "link"; to: string; label: string; external?: boolean }
  | { kind: "action"; label: string; onClick: () => void };

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

type Slot = {
  to: string;
  mark: string;
  title: string;
};

function LandingDrawer({
  mark,
  title,
  description,
  slots,
  rail,
  delayMs,
}: {
  mark: string;
  title: string;
  description: string;
  slots: Slot[];
  rail: Rail;
  delayMs: number;
}) {
  return (
    <div className={styles.drawer} style={{ animationDelay: `${delayMs}ms` }}>
      <div className={styles.drawerInner}>
        {slots.map((s) => (
          <Link key={s.to} to={s.to} className={styles.drawerSlot}>
            <span className={styles.drawerSlotMark}>{s.mark}</span>
            <span className={styles.drawerSlotTitle}>{s.title}</span>
          </Link>
        ))}
      </div>

      <div className={styles.drawerSheet}>
        <div className={styles.drawerSheetMain}>
          <span className={styles.cardMark} aria-hidden>
            {mark}
          </span>
          <span className={styles.cardTitle}>{title}</span>
          <span className={styles.cardDesc}>{description}</span>
        </div>
        {rail.kind === "link" ? (
          rail.external ? (
            <a
              href={rail.to}
              className={styles.drawerRail}
              target="_blank"
              rel="noreferrer"
            >
              {rail.label}
            </a>
          ) : (
            <Link to={rail.to} className={styles.drawerRail}>
              {rail.label}
            </Link>
          )
        ) : (
          <button
            type="button"
            className={styles.drawerRail}
            onClick={rail.onClick}
          >
            {rail.label}
          </button>
        )}
      </div>
    </div>
  );
}

export function LandingPage() {
  const { user } = useAuth();
  const displayName = getDisplayName(user);
  const welcomeNote = useMemo(
    () => WELCOME_NOTES[Math.floor(Math.random() * WELCOME_NOTES.length)],
    []
  );
  const [randomCard, setRandomCard] = useState<ScryfallCard | null>(null);
  const [randomBusy, setRandomBusy] = useState(false);

  async function openRandom() {
    if (randomBusy) return;
    setRandomBusy(true);
    const { card } = await fetchRandomCard();
    setRandomBusy(false);
    if (card) setRandomCard(card);
  }

  const searchDrawer = (
    <LandingDrawer
      mark="S"
      title="Search"
      description="Look up any Magic card."
      delayMs={80}
      slots={[
        { to: "/search?mode=syntax", mark: "Y", title: "Syntax" },
        { to: "/search?mode=advanced", mark: "A", title: "Advanced" },
      ]}
      rail={{
        kind: "action",
        label: randomBusy ? "Drawing…" : "Random card",
        onClick: () => void openRandom(),
      }}
    />
  );

  const myDrawer = user ? (
    <LandingDrawer
      mark={(displayName || "M").charAt(0).toUpperCase()}
      title="My..."
      description="Your collection space."
      delayMs={150}
      slots={[
        { to: "/my-decks", mark: "D", title: "Decks" },
        { to: "/drawers", mark: "W", title: "Drawers" },
      ]}
      rail={{ kind: "link", to: "/login", label: "My account" }}
    />
  ) : (
    <Link
      to="/login"
      className={styles.card}
      style={{ animationDelay: "150ms" }}
    >
      <span className={styles.cardMark} aria-hidden>
        L
      </span>
      <span className={styles.cardTitle}>Log in</span>
      <span className={styles.cardDesc}>
        Sign in to save decks and sync your collection.
      </span>
    </Link>
  );

  const communityDrawer = (
    <LandingDrawer
      mark="C"
      title="Community"
      description="Lists beyond your own."
      delayMs={220}
      slots={[
        { to: "/decks?view=friends", mark: "F", title: "Friends" },
        { to: "/decks", mark: "P", title: "Public decks" },
      ]}
      rail={{
        kind: "link",
        to: "https://discord.com/invite/placeholder",
        label: "Discord",
        external: true,
      }}
    />
  );

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
              <span className={styles.titleAccent}>{displayName}</span>.{" "}
              {welcomeNote}
            </>
          ) : (
            "Search the full card pool, study public lists, and shape your next brew — all in one place."
          )}
        </p>
      </div>

      <div className={styles.actions}>
        {searchDrawer}
        {myDrawer}
        {communityDrawer}
      </div>

      {!user && (
        <p className={styles.footerHint}>
          <Link to="/login" className={styles.inlineLink}>
            Log in
          </Link>{" "}
          to save decks and preferences.
        </p>
      )}

      {randomCard && (
        <CardInspectorModal
          scryfallId={randomCard.id}
          name={randomCard.name}
          imageUrl={
            randomCard.image_uris?.normal ||
            randomCard.card_faces?.[0]?.image_uris?.normal
          }
          onClose={() => setRandomCard(null)}
        />
      )}
    </div>
  );
}
