import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CardImage } from "../components/CardImage";
import { CardNameSwitcher } from "../components/CardNameSwitcher";
import {
  ArtworkTab,
  CollectionsTab,
  DeckTab,
  DrawersTab,
  InfoTab,
  MechanicsTab,
  type InspectorTabId,
} from "../components/inspector";
import { useAuth } from "../auth/AuthProvider";
import { useArtPreferences } from "../auth/ArtPreferencesProvider";
import { supabase } from "../lib/supabaseClient";
import { fetchCardById, fetchRulings, type ScryfallRuling } from "../lib/scryfallApi";
import { mapScryfallToDeckApp } from "../lib/cards/mapScryfallToDeckApp";
import { withResolvedImages } from "../lib/cards/withResolvedImages";
import type { DeckAppCard } from "../types/deckAppCard";
import type { ScryfallCard } from "../types/scryfallCard";
import transitions from "../styles/pageTransitions.module.css";
import styles from "./CardPage.module.css";

const TABS: { id: InspectorTabId; label: string }[] = [
  { id: "info", label: "Info" },
  { id: "deck", label: "Deck" },
  { id: "drawers", label: "Drawers" },
  { id: "collections", label: "Collections" },
  { id: "mechanics", label: "Mechanics" },
  { id: "artwork", label: "Artwork" },
];

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
  const [rulings, setRulings] = useState<ScryfallRuling[]>([]);
  const [rulingsLoading, setRulingsLoading] = useState(false);
  const [active, setActive] = useState<InspectorTabId>("info");
  const [infoSub, setInfoSub] = useState("details");
  const [artSub, setArtSub] = useState("prints");

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
    setRulingsLoading(true);
    void fetchRulings(card.id, card.oracle_id).then(({ rulings: list, error: err }) => {
      if (cancelled) return;
      setRulingsLoading(false);
      if (err) {
        setRulings([]);
        return;
      }
      setRulings(list);
    });
    return () => {
      cancelled = true;
    };
  }, [card]);

  useEffect(() => {
    if (!user || !card) {
      setUsefulIn([]);
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

  const displayCard = card ? withResolvedImages(card, resolved) : null;
  const displayName = displayCard?.name ?? card?.name ?? "Card";

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
            <div className={styles.tabRail} role="tablist">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={active === t.id}
                  className={`${styles.tabPill}${active === t.id ? ` ${styles.tabPillOn}` : ""}`}
                  onClick={() => setActive(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <section className={styles.section} role="tabpanel">
              <h2 className={styles.sectionTitle}>
                {TABS.find((t) => t.id === active)?.label}
              </h2>
              {active === "info" && (
                <InfoTab
                  subId={infoSub}
                  onSelectSub={setInfoSub}
                  displayCard={displayCard}
                  displayName={displayName}
                  scryfallId={card.id}
                  loading={false}
                  error={null}
                  onClose={() => {}}
                  hidePageLink
                  rulings={rulings}
                  rulingsLoading={rulingsLoading}
                  rulingsError={null}
                />
              )}
              {active === "deck" && (
                <DeckTab
                  scryfallId={card.id}
                  oracleId={card.oracle_id}
                  name={displayName}
                  typeLine={card.type_line}
                  onRemove={() => {}}
                />
              )}
              {active === "drawers" && (
                <DrawersTab
                  card={displayCard}
                  usefulInTags={usefulIn}
                  onUsefulInChange={setUsefulIn}
                />
              )}
              {active === "collections" && (
                <CollectionsTab card={displayCard} name={displayName} />
              )}
              {active === "mechanics" && <MechanicsTab card={displayCard} />}
              {active === "artwork" && (
                <ArtworkTab
                  subId={artSub}
                  onSelectSub={setArtSub}
                  card={displayCard}
                  onResolvedChange={onResolvedChange}
                />
              )}
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
