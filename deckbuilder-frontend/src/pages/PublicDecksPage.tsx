import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { CopyReadyDialog } from "../components/CopyReadyDialog";
import { cloneDeck, listPublicDecks } from "../services/deckService";
import type { Deck } from "../types/deck";
import styles from "./MyDecksPage.module.css";

export function PublicDecksPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const friendsView = params.get("view") === "friends";
  const [decks, setDecks] = useState<Deck[]>([]);
  const [loading, setLoading] = useState(true);
  const [format, setFormat] = useState("all");
  const [error, setError] = useState<string | null>(null);
  const [ask, setAsk] = useState<Deck | null>(null);
  const [ready, setReady] = useState<{ id: string; name: string } | null>(null);
  const [shared, setShared] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  useEffect(() => {
    void listPublicDecks().then(({ decks: list, error: err }) => {
      setDecks(list);
      setError(err);
      setLoading(false);
    });
  }, []);

  async function copy(deck: Deck) {
    if (!user) {
      navigate("/login");
      return;
    }
    setBusy(true);
    const { deck: next, error: err } = await cloneDeck(deck.id, user.id);
    setBusy(false);
    if (err || !next) {
      setError(err ?? "Could not copy deck.");
      return;
    }
    setAsk(null);
    setReady({ id: next.id, name: next.name });
  }

  async function share(deck: Deck) {
    const url = `${window.location.origin}/deck/${deck.id}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: deck.name, url });
        setShared(deck.id);
        return;
      } catch {
        // Fall through to clipboard if the share sheet is dismissed.
      }
    }
    await navigator.clipboard.writeText(url);
    setShared(deck.id);
    setOpenMenu(null);
  }

  const formats = [...new Set(decks.map((d) => d.format).filter(Boolean))];
  const visible = format === "all" ? decks : decks.filter((d) => d.format === format);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>{friendsView ? "Friends" : "Public decks"}</h1>
          <p className={styles.subtitle}>
            {friendsView
              ? "Friend lists will live here. This is the placeholder until social follows are built."
              : "Open a list, clone it, or share the link."}
          </p>
        </div>
      </header>
      {friendsView && (
        <section className={styles.folder}>
          <div className={styles.folderHead}><h2>Coming next</h2></div>
          <p className={styles.empty}>Follow players, see their public decks, and share your own lists with a group.</p>
          <Link to="/decks">Browse public decks</Link>
        </section>
      )}
      {!friendsView && formats.length > 1 && (
        <div className={styles.tabs}>
          <button type="button" className={`${styles.tab} ${format === "all" ? styles.tabOn : ""}`} onClick={() => setFormat("all")}>All</button>
          {formats.map((f) => (
            <button key={f} type="button" className={`${styles.tab} ${format === f ? styles.tabOn : ""}`} onClick={() => setFormat(f)}>{f}</button>
          ))}
        </div>
      )}
      {!friendsView && error && <p className={styles.error}>{error}</p>}
      {!friendsView && loading && <p className={styles.status}>Loading public decks…</p>}
      {!friendsView && !loading && visible.length === 0 && <p className={styles.empty}>No public decks yet.</p>}
      {!friendsView && (
      <ul className={styles.list}>
        {visible.map((d) => (
          <li key={d.id} className={styles.deckItem}>
            <Link to={`/deck/${d.id}`} className={styles.deckLink}>
              <span className={styles.deckName}>{d.name}</span>
              <span className={styles.deckMeta}>{d.format}</span>
            </Link>
            <div className={styles.menuWrap}>
              <button type="button" className={styles.menuBtn} aria-label={`Options for ${d.name}`} onClick={() => setOpenMenu(openMenu === d.id ? null : d.id)}>⋯</button>
              {openMenu === d.id && (
                <div className={styles.menu}>
                  <button type="button" className={styles.menuLink} onClick={() => { setOpenMenu(null); setAsk(d); }}>Clone</button>
                  <button type="button" className={styles.menuLink} onClick={() => void share(d)}>{shared === d.id ? "Link copied" : "Share"}</button>
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
      )}
      {ask && (
        <CopyReadyDialog
          title="Clone this public deck?"
          body="This makes a private copy."
          confirmLabel="Clone"
          cancelLabel="Cancel"
          busy={busy}
          onCancel={() => setAsk(null)}
          onConfirm={() => void copy(ask)}
        />
      )}
      {ready && (
        <CopyReadyDialog
          title="Clone ready"
          body={`${ready.name} has been built.`}
          cancelLabel="Stay here"
          onCancel={() => setReady(null)}
          extra={{ label: "Open new deck", onClick: () => navigate(`/deck/${ready.id}`) }}
        />
      )}
    </div>
  );
}