import { BulkCardImport } from "./BulkCardImport";
import { DrawerPanel } from "./DrawerPanel";
import { TextExportMenu } from "./TextExportMenu";
import type { DeckCard, DeckToken } from "../types/deck";
import styles from "../pages/DeckBuilderPage.module.css";

type ExportSection = { title: string; items: { name: string; quantity: number }[] };

type Props = {
  isOwner: boolean;
  deckName: string;
  cards: DeckCard[];
  deckTokens: DeckToken[];
  commanderColorIdentity: string[];
  deckQtyByOracle: Record<string, number>;
  exportSections: ExportSection[];
  onBulkImport: (entries: unknown[]) => void;
  onAddFromDrawer: (c: unknown) => void;
  onAdjustFromDrawer: (c: unknown, d: number) => void;
  onApplyDrawer: (c: unknown) => void;
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
