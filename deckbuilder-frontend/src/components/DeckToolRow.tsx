import { BulkCardImport, type BulkResolvedEntry } from "./BulkCardImport";
import { DrawerPanel } from "./DrawerPanel";
import { TextExportMenu } from "./TextExportMenu";
import type { DeckCard } from "../types/deck";
import type { DeckToken } from "../lib/deck/deckTokens";
import type { DrawerCardView } from "../types/drawer";
import type { ExportSection } from "../lib/cards/exportCardList";
import styles from "../pages/DeckBuilderPage.module.css";

type Props = {
  isOwner: boolean;
  deckName: string;
  cards: DeckCard[];
  deckTokens: DeckToken[];
  commanderColorIdentity: string[];
  deckQtyByOracle: Record<string, number>;
  exportSections: ExportSection[];
  onBulkImport: (entries: BulkResolvedEntry[]) => void;
  onAddFromDrawer: (c: DrawerCardView) => void;
  onAdjustFromDrawer: (c: DrawerCardView, d: number) => void;
  onApplyDrawer: (cards: DrawerCardView[]) => void;
};

export function DeckToolRow({
  isOwner, deckName, cards, deckTokens, commanderColorIdentity, deckQtyByOracle,
  exportSections, onBulkImport, onAddFromDrawer, onAdjustFromDrawer, onApplyDrawer,
}: Props) {
  const ttsParts = [
    {
      name: `${deckName} main`,
      cards: cards
        .filter((c) => c.board === "main" || c.board === "commander")
        .map((c) => ({ name: c.name, scryfallId: c.scryfall_id, quantity: c.quantity })),
    },
    {
      name: `${deckName} side`,
      cards: cards
        .filter((c) => c.board === "side")
        .map((c) => ({ name: c.name, scryfallId: c.scryfall_id, quantity: c.quantity })),
    },
  ];

  const extraSections = deckTokens.some((t) => t.included)
    ? [{
        title: "Tokens",
        items: deckTokens.filter((t) => t.included).map((t) => ({ name: t.name, quantity: t.quantity || 1 })),
      }]
    : undefined;

  return (
    <div className={styles.toolRow}>
      <BulkCardImport title="Bulk import" respectQuantity={true} onImport={onBulkImport} />
      {isOwner && (
        <DrawerPanel
          onAddCard={onAddFromDrawer}
          onAdjustCard={onAdjustFromDrawer}
          onApplyDrawer={onApplyDrawer}
          commanderColorIdentity={commanderColorIdentity}
          applyBoardLabel="Mainboard"
          deckQtyByOracle={deckQtyByOracle}
        />
      )}
      <TextExportMenu
        sections={exportSections}
        fileBaseName={deckName}
        ttsParts={ttsParts}
        extraSections={extraSections}
        extraLabel="Include tokens"
      />
    </div>
  );
}
