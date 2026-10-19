import type { ReactNode } from "react";
import type { DeckBoard, DeckCard, DeckTag } from "../../types/deck";

export type CardInspectorDeckControls = {
  card: DeckCard;
  isOwner: boolean;
  tags: DeckTag[];
  onQty: (delta: number) => void;
  onBoard: (board: DeckBoard) => void;
  onRemove: () => void;
  onToggleTag: (tag: DeckTag) => void;
  onCreateTag?: (name: string) => Promise<void> | void;
};

export type CardInspectorDrawerControls = {
  drawerName: string;
  tier: number;
  isOwner: boolean;
  onTier: (next: number) => void;
  onRemove: () => void;
};

export type InspectorTabId =
  | "info"
  | "deck"
  | "drawer"
  | "drawers"
  | "collections"
  | "mechanics"
  | "artwork";

export type SubTab = {
  id: string;
  label: string;
};

/**
 * A tab the shell can render. Content is owned by the module;
 * the shell only knows id, label, optional sub-tabs, and whether
 * the body must stay mounted across switches.
 */
export type InspectorTab = {
  id: InspectorTabId;
  label: string;
  subTabs?: SubTab[];
  keepMounted?: boolean;
  /** Optional extra in the panel title row (e.g. "Manage drawers"). */
  titleExtra?: ReactNode;
  render: (subId: string | null) => ReactNode;
};
