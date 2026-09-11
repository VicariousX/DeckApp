import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { useArtPreferences } from "../auth/ArtPreferencesProvider";
import { syncUserCardFromArt } from "../services/userCardService";
import { fetchPrintings } from "../lib/scryfallApi";
import {
  applyUserCardArt,
  mapScryfallToDeckApp,
} from "../lib/cards/mapScryfallToDeckApp";
import {
  fetchUserCardArt,
  getCardArtPublicBase,
  removeCustomCardImage,
  uploadCustomCardImage,
  upsertUserCardArt,
} from "../services/cardArtService";
import type { DeckAppCard, UserCardArt } from "../types/deckAppCard";
import type { ScryfallCard } from "../types/scryfallCard";
import { getFaceImage, getFaces } from "../utils/scryfall";
import styles from "./CardArtPanel.module.css";

type Props = {
  card: ScryfallCard;
  onResolvedChange?: (resolved: DeckAppCard) => void;
};

export function CardArtPanel({ card, onResolvedChange }: Props) {
  const { user } = useAuth();
  const { applyArtPreference, reload: reloadArtPrefs } = useArtPreferences();
  const [printings, setPrintings] = useState<ScryfallCard[]>([]);
  const [art, setArt] = useState<UserCardArt | null>(null);
  const [loadingPrints, setLoadingPrints] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const frontInputRef = useRef<HTMLInputElement>(null);
  const backInputRef = useRef<HTMLInputElement>(null);

  const oracleId = card.oracle_id ?? card.id;
  const isMulti =
    Array.isArray(card.card_faces) && card.card_faces.length > 1;

  // Emit resolved card whenever base card or art changes
  useEffect(() => {
    const preferredMap = new Map<string, ScryfallCard>();
    for (const p of printings) {
      preferredMap.set(p.id.toLowerCase(), p);
      preferredMap.set(p.id, p);
    }
    preferredMap.set(card.id.toLowerCase(), card);
    preferredMap.set(card.id, card);

    const base = mapScryfallToDeckApp(card);
    const resolved = applyUserCardArt(base, art, {
      publicStorageBase: getCardArtPublicBase(),
      preferredPrintings: preferredMap,
    });
    onResolvedChange?.(resolved);
  }, [card, art, printings, onResolvedChange]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoadingPrints(true);
      setError(null);
      const { cards, error: printErr } = await fetchPrintings(oracleId);
      if (cancelled) return;
      if (printErr) setError(printErr);
      setPrintings(cards);
      setLoadingPrints(false);

      if (user) {
        const { art: row, error: artErr } = await fetchUserCardArt(
          user.id,
          oracleId
        );
        if (cancelled) return;
        if (artErr) setError(artErr);
        setArt(row);
      } else {
        setArt(null);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [oracleId, user, card.id]);

  function findPrinting(id: string | null | undefined): ScryfallCard | null {
    if (!id) return null;
    const lower = id.toLowerCase();
    return (
      printings.find((p) => p.id.toLowerCase() === lower) ??
      (card.id.toLowerCase() === lower ? card : null)
    );
  }

  async function selectPrinting(printing: ScryfallCard) {
    if (!user) return;
    setBusy(true);
    setMessage(null);
    setError(null);
    const { art: row, error: err } = await upsertUserCardArt(user.id, {
      oracle_id: oracleId,
      preferred_scryfall_id: printing.id,
    });
    if (err) {
      setBusy(false);
      setError(err);
      return;
    }
    setArt(row);
    // Seed in-memory prefs + preferred printing immediately (no race with reload)
    applyArtPreference(oracleId, row, printing);
    // Persist local cache first, then soft-reload so other tabs stay consistent
    await syncUserCardFromArt(user.id, oracleId, row, printing);
    void reloadArtPrefs();
    setBusy(false);
    setMessage(
      `Preferred art set to ${printing.set_name} (#${printing.collector_number}).`
    );
  }

  async function clearPreferred() {
    if (!user) return;
    setBusy(true);
    setError(null);
    const { art: row, error: err } = await upsertUserCardArt(user.id, {
      oracle_id: oracleId,
      preferred_scryfall_id: null,
    });
    if (err) {
      setBusy(false);
      setError(err);
      return;
    }
    setArt(row);
    applyArtPreference(oracleId, row, null);
    await syncUserCardFromArt(user.id, oracleId, row, card);
    void reloadArtPrefs();
    setBusy(false);
    setMessage("Preferred printing cleared.");
  }

  async function onUpload(
    side: "front" | "back",
    file: File | undefined | null
  ) {
    if (!user || !file) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    const { error: err } = await uploadCustomCardImage(
      user.id,
      oracleId,
      side,
      file
    );
    if (err) {
      setBusy(false);
      setError(err);
      return;
    }
    const { art: row } = await fetchUserCardArt(user.id, oracleId);
    setArt(row);
    applyArtPreference(oracleId, row, null);
    await syncUserCardFromArt(user.id, oracleId, row, findPrinting(row?.preferred_scryfall_id) ?? card);
    void reloadArtPrefs();
    setBusy(false);
    setMessage(`Custom ${side} image uploaded.`);
  }

  async function onRemoveCustom(side: "front" | "back") {
    if (!user) return;
    setBusy(true);
    setError(null);
    const { error: err } = await removeCustomCardImage(
      user.id,
      oracleId,
      side
    );
    if (err) {
      setBusy(false);
      setError(err);
      return;
    }
    const { art: row } = await fetchUserCardArt(user.id, oracleId);
    setArt(row);
    const preferred = findPrinting(row?.preferred_scryfall_id);
    applyArtPreference(oracleId, row, preferred);
    await syncUserCardFromArt(user.id, oracleId, row, preferred ?? card);
    void reloadArtPrefs();
    setBusy(false);
    setMessage(`Custom ${side} image removed.`);
  }

  if (!user) {
    return (
      <section className={styles.panel}>
        <h2 className={styles.title}>Your card art</h2>
        <p className={styles.hint}>
          <Link to="/login" className={styles.link}>
            Sign in
          </Link>{" "}
          to choose preferred printings or upload custom art for this card.
        </p>
      </section>
    );
  }

  const preferredId = art?.preferred_scryfall_id ?? null;

  return (
    <section className={styles.panel}>
      <div className={styles.header}>
        <h2 className={styles.title}>Your card art</h2>
        <p className={styles.hint}>
          Pick a Scryfall printing or upload your own image. Custom art is used
          on this site and in future deck exports.
        </p>
      </div>

      {(message || error) && (
        <p className={error ? styles.errorMsg : styles.okMsg}>
          {error ?? message}
        </p>
      )}

      <div className={styles.section}>
        <div className={styles.sectionHead}>
          <h3 className={styles.sectionTitle}>Preferred printing</h3>
          {preferredId && (
            <button
              type="button"
              className={styles.textBtn}
              disabled={busy}
              onClick={() => void clearPreferred()}
            >
              Clear preference
            </button>
          )}
        </div>
        {loadingPrints ? (
          <p className={styles.hint}>Loading printings…</p>
        ) : printings.length === 0 ? (
          <p className={styles.hint}>No alternate printings found.</p>
        ) : (
          <div className={styles.printGrid}>
            {printings.map((p) => {
              const thumb = getFaceImage(p, 0);
              const faces = getFaces(p);
              const selected = preferredId === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  className={
                    selected
                      ? `${styles.printCard} ${styles.printCardSelected}`
                      : styles.printCard
                  }
                  disabled={busy}
                  onClick={() => void selectPrinting(p)}
                  title={`${p.set_name} · #${p.collector_number}`}
                >
                  {thumb ? (
                    <img src={thumb} alt="" className={styles.printThumb} />
                  ) : (
                    <div className={styles.printPlaceholder} />
                  )}
                  <span className={styles.printMeta}>
                    <span className={styles.printSet}>{p.set.toUpperCase()}</span>
                    <span className={styles.printNum}>#{p.collector_number}</span>
                  </span>
                  {faces[0]?.artist && (
                    <span className={styles.printArtist}>{faces[0].artist}</span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Custom images</h3>
        <div className={styles.uploadRow}>
          <div className={styles.uploadBlock}>
            <span className={styles.uploadLabel}>Front</span>
            {art?.custom_front_path ? (
              <div className={styles.customPreview}>
                <img
                  src={`${getCardArtPublicBase()}/${art.custom_front_path}`}
                  alt="Custom front"
                  className={styles.customImg}
                />
                <button
                  type="button"
                  className={styles.textBtn}
                  disabled={busy}
                  onClick={() => void onRemoveCustom("front")}
                >
                  Remove
                </button>
              </div>
            ) : (
              <p className={styles.hint}>No custom front</p>
            )}
            <input
              ref={frontInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className={styles.fileInput}
              onChange={(e) => {
                void onUpload("front", e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              className={styles.secondaryBtn}
              disabled={busy}
              onClick={() => frontInputRef.current?.click()}
            >
              Upload front
            </button>
          </div>

          <div className={styles.uploadBlock}>
            <span className={styles.uploadLabel}>
              Back{!isMulti ? " (optional)" : ""}
            </span>
            {art?.custom_back_path ? (
              <div className={styles.customPreview}>
                <img
                  src={`${getCardArtPublicBase()}/${art.custom_back_path}`}
                  alt="Custom back"
                  className={styles.customImg}
                />
                <button
                  type="button"
                  className={styles.textBtn}
                  disabled={busy}
                  onClick={() => void onRemoveCustom("back")}
                >
                  Remove
                </button>
              </div>
            ) : (
              <p className={styles.hint}>No custom back</p>
            )}
            <input
              ref={backInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className={styles.fileInput}
              onChange={(e) => {
                void onUpload("back", e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              className={styles.secondaryBtn}
              disabled={busy}
              onClick={() => backInputRef.current?.click()}
            >
              Upload back
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
