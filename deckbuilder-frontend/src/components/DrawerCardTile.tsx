import { Link } from "react-router-dom";
import type { DrawerCardView } from "../types/drawer";
import { CardTile } from "./CardTile";
import styles from "./DrawerCardTile.module.css";

type Props = {
  card: DrawerCardView;
  showTierMark: boolean;
  onOpen: () => void;
  onRemove: () => void;
  onTier: (next: number) => void;
  onContextMenu?: (e: { preventDefault: () => void; clientX: number; clientY: number }) => void;
};

/** Drawer roll-out: Card Page, tier, flip, remove. */
export function DrawerCardTile({
  card,
  showTierMark,
  onOpen,
  onRemove,
  onTier,
  onContextMenu,
}: Props) {
  return (
    <CardTile
      face={{
        name: card.name,
        imageUrl: card.image_url,
        scryfallId: card.scryfall_id,
        oracleId: card.oracle_id,
      }}
      ear={showTierMark ? card.tier ?? 1 : undefined}
      onOpen={onOpen}
      onContextMenu={onContextMenu}
      top={
        card.scryfall_id ? (
          <Link className={`${styles.slide} ${styles.nameSlide}`} to={`/card/${card.scryfall_id}`}>
            Card Page
          </Link>
        ) : undefined
      }
      right={[
        <>
          <span className={styles.railLabel}>Tier</span>
          <button
            type="button"
            className={styles.tinyBtn}
            disabled={(card.tier ?? 1) <= 1}
            onClick={(e) => {
              e.stopPropagation();
              onTier((card.tier ?? 1) - 1);
            }}
          >
            ↑
          </button>
          <span className={styles.tierVal}>{card.tier ?? 1}</span>
          <button
            type="button"
            className={styles.tinyBtn}
            onClick={(e) => {
              e.stopPropagation();
              onTier((card.tier ?? 1) + 1);
            }}
          >
            ↓
          </button>
        </>,
      ]}
      bottom={
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          style={{ all: "unset", cursor: "pointer", width: "100%", textAlign: "center" }}
        >
          Remove
        </button>
      }
    />
  );
}

export { CardTileField as DrawerTileField } from "./CardTile";
