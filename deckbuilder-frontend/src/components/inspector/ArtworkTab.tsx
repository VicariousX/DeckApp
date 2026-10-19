import type { ScryfallCard } from "../../types/scryfallCard";
import { CardArtPanel } from "../CardArtPanel";
import { SubTabRail } from "./SubTabRail";
import type { SubTab } from "./types";
import styles from "../CardInspectorModal.module.css";

export const ART_SUBS: SubTab[] = [
  { id: "prints", label: "Printings" },
  { id: "upload", label: "Upload" },
];

export function ArtworkTab({
  subId,
  onSelectSub,
  card,
}: {
  subId: string;
  onSelectSub: (id: string) => void;
  card: ScryfallCard | null;
}) {
  return (
    <div className={styles.panelScroll}>
      <SubTabRail subTabs={ART_SUBS} active={subId} onSelect={onSelectSub} />
      {card ? (
        <CardArtPanel
          card={card}
          embedded
          forceSub={subId === "upload" ? "upload" : "prints"}
        />
      ) : (
        <p className={styles.muted}>Load card to edit art.</p>
      )}
    </div>
  );
}
