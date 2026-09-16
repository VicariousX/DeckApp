import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { RateLimitedImg } from "./RateLimitedImg";
import { preloadScryfallImages } from "../lib/scryfallImageQueue";
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
  /** Skip outer shell; show inner collapsible upload/print blocks. */
  embedded?: boolean;
  /** When embedded, force which sub-section is shown (controlled by parent tabs). */
  forceSub?: "upload" | "prints";
};

export function CardArtPanel({
  card,
  onResolvedChange,
  embedded = false,
  forceSub,
}: Props) {
  const { user } = useAuth();
  const { applyArtPreference } = useArtPreferences();
  const [printings, setPrintings] = useState<ScryfallCard[]>([]);
  const [art, setArt] = useState<UserCardArt | null>(null);
  const [loadingPrints, setLoadingPrints] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(embedded);
  const [uploadOpen, setUploadOpen] = useState(true);
  const [printsOpen, setPrintsOpen] = useState(false);
  useEffect(() => {
    if (printings.length === 0) return;
    const urls = printings
      .map((p) => getFaceImage(p, 0))
      .filter((u): u is string => Boolean(u));
    preloadScryfallImages(urls);
  }, [printings]);

  const [printHover, setPrintHover] = useState<{ src: string; x: number; y: number } | null>(null);
  const printHoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const printHoverPending = useRef<{ src: string; x: number; y: number } | null>(
    null
  );
  const PRINT_HOVER_DELAY_MS = 380;

  useEffect(() => {
    return () => {
      if (printHoverTimer.current) clearTimeout(printHoverTimer.current);
    };
  }, []);
  const frontInputRef = useRef<HTMLInputElement>(null);
  const backInputRef = useRef<HTMLInputElement>(null);

  const oracleId = (card.oracle_id ?? card.id).toLowerCase();
  const isMulti =
    Array.isArray(card.card_faces) && card.card_faces.length > 1;

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
    if (!expanded && !embedded) return;
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
  }, [expanded, embedded, oracleId, user, card.id]);

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
    applyArtPreference(oracleId, row, printing);
    await syncUserCardFromArt(user.id, oracleId, row, printing);
    setBusy(false);
    setMessage(
      `Preferred printing set to ${printing.set_name} (#${printing.collector_number}) — applies to front and back when available.`
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
    await syncUserCardFromArt(
      user.id,
      oracleId,
      row,
      findPrinting(row?.preferred_scryfall_id) ?? card
    );
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
    setBusy(false);
    setMessage(`Custom ${side} image removed.`);
  }

  const preferredId = art?.preferred_scryfall_id
    ? String(art.preferred_scryfall_id).toLowerCase()
    : null;

  const signInMsg = (
    <p className={styles.hint}>
      <Link to="/login" className={styles.link}>
        Sign in
      </Link>{" "}
      to choose preferred printings or upload custom art for this card.
    </p>
  );

  if (!user) {
    if (embedded) return <div className={styles.embedded}>{signInMsg}</div>;
    return (
      <section className={styles.collapsible}>
        <button
          type="button"
          className={styles.collapseHeader}
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
        >
          <span>Art &amp; printings</span>
          <span className={styles.chevron}>{expanded ? "▾" : "▸"}</span>
        </button>
        {expanded && <div className={styles.panel}>{signInMsg}</div>}
      </section>
    );
  }

  const uploadBlock = (
    <div className={styles.innerSection}>
      <button
        type="button"
        className={styles.innerHead}
        aria-expanded={uploadOpen}
        onClick={() => setUploadOpen((v) => !v)}
      >
        <span>Upload custom art</span>
        <span className={styles.chevron}>{uploadOpen ? "▾" : "▸"}</span>
      </button>
      {uploadOpen && (
        <div className={styles.innerBody}>
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
      )}
    </div>
  );

  const printsBlock = (
    <div className={styles.innerSection}>
      <button
        type="button"
        className={styles.innerHead}
        aria-expanded={printsOpen}
        onClick={() => setPrintsOpen((v) => !v)}
      >
        <span>Preferred printing</span>
        <span className={styles.chevron}>{printsOpen ? "▾" : "▸"}</span>
      </button>
      {printsOpen && (
        <div className={styles.innerBody}>
          <div className={styles.sectionHead}>
            {preferredId ? (
              <button
                type="button"
                className={styles.textBtn}
                disabled={busy}
                onClick={() => void clearPreferred()}
              >
                Clear preference
              </button>
            ) : (
              <span className={styles.hint}>Using default printing</span>
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
                const selected =
                  preferredId !== null &&
                  preferredId === String(p.id).toLowerCase();
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
                      <span className={styles.printFallback}>
                        {faces[0]?.name ?? p.name}
                      </span>
                    )}
                    <span className={styles.printMeta}>
                      {p.set?.toUpperCase() ?? p.set_name}
                      {" · "}
                      {p.collector_number}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );

  const statusMsg =
    message || error ? (
      <p className={error ? styles.errorMsg : styles.okMsg}>
        {error ?? message}
      </p>
    ) : null;

  // Controlled sub-tab mode (modal): show a single pane without nested headers
  if (embedded && forceSub) {
    const openUpload = forceSub === "upload";
    const openPrints = forceSub === "prints";
    return (
      <div className={styles.embedded}>
        {statusMsg}
        {openUpload && (
          <div className={styles.innerBodyFlat}>
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
        )}
        {openPrints && (
          <div className={styles.innerBodyFlatFill}>
            <div className={styles.sectionHead}>
              {preferredId ? (
                <button
                  type="button"
                  className={styles.textBtn}
                  disabled={busy}
                  onClick={() => void clearPreferred()}
                >
                  Clear preference
                </button>
              ) : (
                <span className={styles.hint}>
                  Preferred printing applies to front and back when available
                </span>
              )}
            </div>
            {loadingPrints ? (
              <p className={styles.hint}>Loading printings…</p>
            ) : printings.length === 0 ? (
              <p className={styles.hint}>No alternate printings found.</p>
            ) : (
              <div className={styles.printGridFill}>
                {printings.map((p) => {
                  const thumb = getFaceImage(p, 0);
                  const faces = getFaces(p);
                  const selected =
                    preferredId !== null &&
                    preferredId === String(p.id).toLowerCase();
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
                      onMouseEnter={(e) => {
                        if (!thumb) return;
                        const W = 220;
                        const H = 308;
                        const r = e.currentTarget.getBoundingClientRect();
                        const next = {
                          src: thumb,
                          x: r.left + r.width / 2 - W / 2,
                          y: r.top + r.height / 2 - H / 2,
                        };
                        printHoverPending.current = next;
                        if (printHoverTimer.current) {
                          clearTimeout(printHoverTimer.current);
                        }
                        printHoverTimer.current = setTimeout(() => {
                          if (printHoverPending.current) {
                            setPrintHover(printHoverPending.current);
                          }
                        }, PRINT_HOVER_DELAY_MS);
                      }}
                      onMouseLeave={() => {
                        if (printHoverTimer.current) {
                          clearTimeout(printHoverTimer.current);
                          printHoverTimer.current = null;
                        }
                        printHoverPending.current = null;
                        setPrintHover(null);
                      }}
                    >
                      {thumb ? (
                        <RateLimitedImg src={thumb} alt="" className={styles.printThumb} />
                      ) : (
                        <span className={styles.printFallback}>
                          {faces[0]?.name ?? p.name}
                        </span>
                      )}
                      <span className={styles.printMeta}>
                        {p.set?.toUpperCase() ?? p.set_name}
                        {" · "}
                        {p.collector_number}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
            {printHover &&
              createPortal(
                <div
                  className={styles.printHoverPreview}
                  style={{ left: printHover.x, top: printHover.y }}
                >
                  <img src={printHover.src} alt="" />
                </div>,
                document.body
              )}
          </div>
        )}
      </div>
    );
  }

  const content = (
    <>
      {statusMsg}
      {uploadBlock}
      {printsBlock}
    </>
  );

  if (embedded) {
    return <div className={styles.embedded}>{content}</div>;
  }

  return (
    <section className={styles.collapsible}>
      <button
        type="button"
        className={styles.collapseHeader}
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
      >
        <span>Art &amp; printings</span>
        <span className={styles.chevron}>{expanded ? "▾" : "▸"}</span>
      </button>
      {expanded && (
        <div className={styles.panel}>
          <div className={styles.header}>
            <p className={styles.hint}>
              Upload custom art first, or pick a preferred Scryfall printing.
              Custom art is used on this site and in future deck exports.
            </p>
          </div>
          {content}
        </div>
      )}
    </section>
  );
}
