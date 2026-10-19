import { Link } from "react-router-dom";
import type { ScryfallCard } from "../../types/scryfallCard";
import type { ScryfallRuling } from "../../lib/scryfallApi";
import { CardDetail } from "../CardDetail";
import { getFaceImage } from "../../utils/scryfall";
import { SubTabRail } from "./SubTabRail";
import type { SubTab } from "./types";
import styles from "../CardInspectorModal.module.css";

export const INFO_SUBS: SubTab[] = [
  { id: "details", label: "Details" },
  { id: "rulings", label: "Rulings" },
];

export function InfoTab({
  subId,
  onSelectSub,
  displayCard,
  displayName,
  scryfallId,
  frontSrc,
  loading,
  error,
  onClose,
  hidePageLink = false,
  rulings,
  rulingsLoading,
  rulingsError,
}: {
  subId: string;
  onSelectSub: (id: string) => void;
  displayCard: ScryfallCard | null;
  displayName: string;
  scryfallId: string;
  frontSrc?: string;
  loading: boolean;
  error: string | null;
  onClose: () => void;
  hidePageLink?: boolean;
  rulings: ScryfallRuling[];
  rulingsLoading: boolean;
  rulingsError: string | null;
}) {
  return (
    <div className={styles.panelScroll}>
      <SubTabRail subTabs={INFO_SUBS} active={subId} onSelect={onSelectSub} />
      {subId === "details" && (
        <>
          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
          {displayCard && (
            <CardDetail
              card={displayCard}
              hidePrintingMeta={Boolean(
                frontSrc && frontSrc !== getFaceImage(displayCard, 0)
              )}
            />
          )}
          {!displayCard && !loading && (
            <h2 className={styles.fallbackTitle}>{displayName}</h2>
          )}
          {!hidePageLink && (
            <Link
              to={`/card/${scryfallId}`}
              className={styles.detailLink}
              onClick={onClose}
            >
              Open card page →
            </Link>
          )}
        </>
      )}
      {subId === "rulings" && (
        <div className={styles.rulingsList}>
          {rulingsLoading && (
            <p className={styles.rulingsMuted}>Loading rulings…</p>
          )}
          {rulingsError && (
            <p className={styles.error} role="alert">
              {rulingsError}
            </p>
          )}
          {!rulingsLoading && !rulingsError && rulings.length === 0 && (
            <p className={styles.rulingsMuted}>
              No official rulings for this card.
            </p>
          )}
          {rulings.map((r, i) => (
            <article key={`${r.published_at ?? "r"}-${i}`} className={styles.ruling}>
              <header className={styles.rulingMeta}>
                <span>{r.source === "wotc" ? "WotC" : r.source ?? "Ruling"}</span>
                {r.published_at && <time>{r.published_at}</time>}
              </header>
              <p className={styles.rulingBody}>{r.comment}</p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
