import { LibraryTool } from "./LibraryTool";
import type { BulkResolvedEntry } from "./BulkCardImport";
import type { DeckCard } from "../types/deck";
import type { DeckToken } from "../lib/deck/deckTokens";
import type { DrawerCardView } from "../types/drawer";
import type { ExportSection } from "../lib/cards/exportCardList";

type Props = {
  isOwner: boolean;
  deckName: string;
  cards: DeckCard[];
  deckTokens: DeckToken[];
  commanderColorIdentity: string[];
  deckQtyByOracle: Record<string, number>;
  exportSections: ExportSection[];
  stacked?: boolean;
  onBulkImport: (entries: BulkResolvedEntry[]) => void;
  onAddFromDrawer: (c: DrawerCardView) => void;
  onAdjustFromDrawer: (c: DrawerCardView, d: number) => void;
  onApplyDrawer: (cards: DrawerCardView[]) => void;
};

export function DeckToolRow(props: Props) {
  return <LibraryTool {...props} />;
}