import type { ScryfallCard } from "../types/scryfallCard";
import {
  getFaceImage,
  getFaces,
  getOracleText,
} from "../utils/scryfall";

import {
  parseManaCost,
  renderManaSymbol,
  renderTextWithSymbols,
} from "../utils/symbols";

import styles from "./CardDetail.module.css";

type Props = {
  card: ScryfallCard;
  /**
   * When true (custom upload or non-default preferred printing), hide
   * printing-specific flavor text and artist credit.
   */
  hidePrintingMeta?: boolean;
};

export function CardDetail({ card, hidePrintingMeta = false }: Props) {
  const faces = getFaces(card);
  const oracleText = getOracleText(card);
  const bgUrl =
    faces[0]?.image_uris?.art_crop ||
    faces[0]?.image_uris?.normal ||
    faces[0]?.image_uris?.large ||
    getFaceImage(card, 0);

  return (
    <div className={styles.detailContainer}>
      <div
        className={styles.modalBackgroundImage}
        style={bgUrl ? { backgroundImage: `url(${bgUrl})` } : undefined}
      />

      {faces[0].mana_cost && (
        <div className={styles.manaRow}>
          <div className={styles.cardName}>{faces[0].name}</div>
          &nbsp; - &nbsp;
          {parseManaCost(faces[0].mana_cost).map((symbol, i) => (
            <span key={i} className={styles.manaSymbol}>
              {renderManaSymbol(symbol, 22)}
            </span>
          ))}
        </div>
      )}

      {faces[0].type_line && (
        <div className={styles.typeLine}>{faces[0].type_line}</div>
      )}

      {oracleText && (
        <div className={styles.oracleText}>
          {renderTextWithSymbols(oracleText, 16)}
        </div>
      )}

      {!hidePrintingMeta && card.flavor_text && (
        <div className={styles.flavorText}>{card.flavor_text}</div>
      )}

      <div className={styles.divider} />

      <div className={styles.infoRow}>
        <div className={styles.setName}>
          {hidePrintingMeta ? "Alternate art" : card.set_name}
        </div>
        {!hidePrintingMeta && (
          <div className={styles.rarityBadge}>{card.rarity}</div>
        )}
      </div>

      {!hidePrintingMeta && faces[0].artist && (
        <div className={styles.artistLine}>
          Illustrated by {faces[0].artist}
        </div>
      )}
    </div>
  );
}
