import type { ScryfallCard } from "../types/scryfallCard";
import {
  getFaces,
  getOracleText
} from "../utils/scryfall";

import {
  parseManaCost,
  renderManaSymbol,
  renderTextWithSymbols
} from "../utils/symbols";

import styles from "./CardDetail.module.css";

export function CardDetail({ card }: { card: ScryfallCard }) {
  const faces = getFaces(card);
  const oracleText = getOracleText(card);

  return (
    <div className={styles.detailContainer}>

      {/* --- Background Image --- */}
      <div
        className={styles.modalBackgroundImage}
        style={{
          backgroundImage: `url(${faces[0].image_uris?.art_crop ?? ""})`,
        }}
      />



      {/* --- Type Line --- */}
      {faces[0].type_line && (
        <div className={styles.typeLine}>
          {faces[0].type_line}
        </div>
      )}

      {/* --- Mana Cost Row --- */}
      {faces[0].mana_cost && (
        <div className={styles.manaRow}>
          {parseManaCost(faces[0].mana_cost).map((symbol, i) => (
            <span key={i} className={styles.manaSymbol}>
              {renderManaSymbol(symbol, 22)}
            </span>
          ))}
        </div>
      )}

      {/* --- Oracle Text (with official Scryfall symbol SVGs) --- */}
      {oracleText && (
        <div className={styles.oracleText}>
          {renderTextWithSymbols(oracleText, 16)}
        </div>
      )}

      {/* --- Flavor Text --- */}
      {card.flavor_text && (
        <div className={styles.flavorText}>
          {card.flavor_text}
        </div>
      )}

      <div className={styles.divider} />

      {/* --- Set & Rarity Row --- */}
      <div className={styles.infoRow}>
        <div className={styles.setName}>{card.set_name}</div>
        <div className={styles.rarityBadge}>{card.rarity}</div>
      </div>

      {/* --- Artist Line --- */}
      {faces[0].artist && (
        <div className={styles.artistLine}>
          Illustrated by {faces[0].artist}
        </div>
      )}
    </div>
  );
}
