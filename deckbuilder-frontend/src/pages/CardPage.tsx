import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { CardArtPanel } from "../components/CardArtPanel";
import { CardDetail } from "../components/CardDetail";
import { CardImage } from "../components/CardImage";
import { DrawerPicker } from "../components/DrawerPicker";
import { UsefulInPicker } from "../components/UsefulInPicker";
import { CardNameSwitcher } from "../components/CardNameSwitcher";
import { useAuth } from "../auth/AuthProvider";
import { useArtPreferences } from "../auth/ArtPreferencesProvider";
import { supabase } from "../lib/supabaseClient";
import { fetchCardById, fetchRulings, type ScryfallRuling } from "../lib/scryfallApi";
import { mapScryfallToDeckApp } from "../lib/cards/mapScryfallToDeckApp";
import { withResolvedImages } from "../lib/cards/withResolvedImages";
import {
  addCardToDeck,
  listDecksContainingOracle,
  listMyDecks,
  type DeckCardPresence,
} from "../services/deckService";
import { ensureUserCardFromScryfall } from "../services/userCardService";
import {
  getListColumnLayout,
  newListColumnId,
  setListColumnLayout,
} from "../lib/deckPreferences";
import type { Deck, DeckBoard } from "../types/deck";
import type { DeckAppCard } from "../types/deckAppCard";
import type { ScryfallCard } from "../types/scryfallCard";
import transitions from "../styles/pageTransitions.module.css";
import styles from "./CardPage.module.css";

const FROM_OUTSIDE = "From Outside";

export function CardPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { reload: reloadArtPrefs } = useArtPreferences();
  const { user } = useAuth();
  const [card, setCard] = useState<ScryfallCard | null>(null);
  const [resolved, setResolved] = useState<DeckAppCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usefulIn, setUsefulIn] = useState<string[]>([]);
  const [rulingsOpen, setRulingsOpen] = useState(false);
  const [addBoard, setAddBoard] = useState<DeckBoard>("maybe");
  const [rulings, setRulings] = useState<ScryfallRuling[]>([]);
  const [presence, setPresence] = useState<DeckCardPresence[]>([]);
  const [myDecks, setMyDecks] = useState<Deck[]>([]);
  const [addDeckId, setAddDeckId] = useState("");
  const [addBusy, setAddBusy] = useState(false);
  const [addMsg, setAddMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      setCard(null);
      setResolved(null);
      const { card: c, error: err } = await fetchCardById(id!);
      if (cancelled) return;
      if (err || !c) {
        setError(err ?? "Card not found");
        setLoading(false);
        return;
      }
      setCard(c);
      setResolved(mapScryfallToDeckApp(c));
      setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!card) {
      setRulings([]);
      return;
    }
    let cancelled = false;
    void fetchRulings(card.id, card.oracle_id).then(({ rulings: list }) => {
      if (!cancelled) setRulings(list);
    });
    return () => {
      cancelled = true;
    };
  }, [card]);

  useEffect(() => {
    if (!user || !card) {
      setUsefulIn([]);
      setPresence([]);
      setMyDecks([]);
      return;
    }
    const oracleId = (card.oracle_id ?? card.id).toLowerCase();
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from("user_cards")
        .select("useful_in")
        .eq("user_id", user.id)
        .eq("oracle_id", oracleId)
        .maybeSingle();
      if (cancelled) return;
      const u = (data as { useful_in?: string[] | null } | null)?.useful_in;
      setUsefulIn(u && u.length ? u : []);
    })();
    void listDecksContainingOracle(user.id, oracleId).then(({ rows }) => {
      if (!cancelled) setPresence(rows);
    });
    void listMyDecks(user.id).then(({ decks }) => {
      if (!cancelled) setMyDecks(decks);
    });
    return () => {
      cancelled = true;
    };
  }, [user, card]);

  const onResolvedChange = useCallback(
    (next: DeckAppCard) => {
      setResolved(next);
      void reloadArtPrefs();
    },
    [reloadArtPrefs]
  );

  function goBack() {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate("/search");
  }

  async function addToDeck() {
    if (!user || !card || !addDeckId) return;
    setAddBusy(true);
    setAddMsg(null);
    const { card: uc } = await ensureUserCardFromScryfall(user.id, card);
    const { card: added, error: err } = await addCardToDeck(addDeckId, {
      oracle_id: (uc?.oracle_id ?? card.oracle_id ?? card.id).toLowerCase(),
      scryfall_id: uc?.scryfall_id ?? card.id,
      name: card.name,
      type_line: card.type_line ?? "",
      mana_cost: card.mana_cost ?? null,
      cmc: card.cmc ?? null,
      quantity: 1,
      board: addBoard,
    });
    setAddBusy(false);
    if (err || !added) {
      setAddMsg(err ?? "Could not add to deck.");
      return;
    }
    if (addBoard === "maybe") {
      const layout = getListColumnLayout(addDeckId, "maybe");
      let col = layout.columns.find((c) => c.name === FROM_OUTSIDE);
      if (!col) {
        col = { id: newListColumnId(), name: FROM_OUTSIDE };
        layout.columns = [col, ...layout.columns];
      }
      layout.placement = { ...layout.placement, [added.id]: col.id };
      setListColumnLayout(addDeckId, "maybe", layout);
    }
    const boardLabel =
      addBoard === "maybe" ? "maybeboard" : addBoard === "side" ? "sideboard" : "mainboard";
    setAddMsg(
      addBoard === "maybe"
        ? `Added to ${boardLabel} · ${FROM_OUTSIDE}`
        : `Added to ${boardLabel}`
    );
    const oracleId = (card.oracle_id ?? card.id).toLowerCase();
    const { rows } = await listDecksContainingOracle(user.id, oracleId);
    setPresence(rows);
  }

  const displayCard = card ? withResolvedImages(card, resolved) : null;
  const inDeckIds = new Set(presence.map((p) => p.deck.id));
  const boardLabel =
    addBoard === "maybe" ? "Maybe" : addBoard === "side" ? "Side" : "Main";

  function cycleBoard() {
    setAddBoard((b) =>
      b === "maybe" ? "side" : b === "side" ? "main" : "maybe"
    );
  }

  return (
    <div className={`${transitions.page} ${styles.page}`}>
      <div className={styles.topBar}>
        <button type="button" className={styles.backLink} onClick={goBack}>
          ← Back
        </button>
        {card && <CardNameSwitcher currentName={card.name} />}
      </div>

      {loading && <p className={styles.status}>Loading card…</p>}
      {error && <p className={styles.statusError}>{error}</p>}

      {!loading && card && displayCard && (
        <div className={styles.layout}>
          <aside className={styles.visual}>
            <div className={styles.imageFrame}>
              <CardImage
                card={displayCard}
                tilt
                hideFaceBadge
                hideControls
                bothLayout="stack"
              />
            </div>
          </aside>

          <div className={styles.stack}>
            <section className={styles.section} id="info">
              <h2 className={styles.sectionTitle}>Info</h2>
              <CardDetail
                card={displayCard}
                hidePrintingMeta={Boolean(
                  resolved?.has_custom_art || resolved?.has_preferred_printing
                )}
              />
              <button
                type="button"
                className={`${styles.plainStrip}${rulingsOpen ? ` ${styles.plainStripOn}` : ""}`}
                aria-expanded={rulingsOpen}
                onClick={() => setRulingsOpen((v) => !v)}
              >
                Rulings
              </button>
              <div
                className={`${styles.stripReveal}${rulingsOpen ? ` ${styles.stripRevealOpen}` : ""}`}
              >
                <div className={styles.stripRevealInner}>
                  {rulings.length === 0 ? (
                    <p className={styles.muted}>No rulings on file.</p>
                  ) : (
                    <ul className={styles.rulingScroll}>
                      {rulings.map((r, i) => (
                        <li key={`${r.published_at}-${i}`}>
                          <span className={styles.rulingDate}>{r.published_at}</span>
                          {r.comment}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </section>

            <section className={styles.section} id="artwork">
              <h2 className={styles.sectionTitle}>Artwork</h2>
              <CardArtPanel card={card} onResolvedChange={onResolvedChange} />
            </section>

            <section className={styles.section} id="deck">
              <h2 className={styles.sectionTitle}>Decks</h2>
              {user ? (
                <>
                  <p className={styles.muted}>
                    This card is in the following decks:
                  </p>
                  <div className={styles.deckScroll}>
                    {presence.length === 0 ? (
                      <p className={styles.muted}>None yet.</p>
                    ) : (
                      <ul className={styles.deckList}>
                        {presence.map((p) => (
                          <li key={`${p.deck.id}-${p.board}`}>
                            <Link to={`/deck/${p.deck.id}`}>{p.deck.name}</Link>
                            <span className={styles.muted}>
                              {" "}
                              · {p.board} · ×{p.quantity}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className={styles.addRow}>
                    <select
                      className={styles.select}
                      value={addDeckId}
                      onChange={(e) => setAddDeckId(e.target.value)}
                    >
                      <option value="">Choose a deck…</option>
                      {myDecks.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                          {inDeckIds.has(d.id) ? " (already in)" : ""}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className={styles.boardCycle}
                      onClick={cycleBoard}
                      title="Cycle board"
                    >
                      {boardLabel}
                    </button>
                    <button
                      type="button"
                      className={styles.primaryBtn}
                      disabled={!addDeckId || addBusy}
                      onClick={() => void addToDeck()}
                    >
                      {addBusy ? "Adding…" : "Add"}
                    </button>
                  </div>
                  {addMsg && <p className={styles.muted}>{addMsg}</p>}
                </>
              ) : (
                <p className={styles.muted}>Sign in to track this card in decks.</p>
              )}
            </section>

            <section className={styles.section} id="drawers">
              <div className={styles.sectionHeadRow}>
                <h2 className={styles.sectionTitle}>Drawers</h2>
                <Link to="/drawers" className={styles.relatedLink}>
                  Manage drawers →
                </Link>
              </div>
              <UsefulInPicker
                oracleId={(card.oracle_id ?? card.id).toLowerCase()}
                scryfallCard={card}
                value={usefulIn}
                onChange={setUsefulIn}
              />
              <p className={styles.drawersBlockLabel}>Drawer membership</p>
              <DrawerPicker
                oracleId={(card.oracle_id ?? card.id).toLowerCase()}
                scryfallCard={card}
                inline
              />
            </section>
          </div>
        </div>
      )}

    </div>
  );
}
