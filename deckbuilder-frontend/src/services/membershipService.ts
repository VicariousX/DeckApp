import { supabase } from "../lib/supabaseClient";
import type { Collection } from "../types/collection";
import type { Deck, DeckBoard } from "../types/deck";
import type { Drawer } from "../types/drawer";
import {
  addCardToCollection,
  listCollectionsContainingCard,
  removeCardFromCollection,
} from "./collectionService";
import {
  addCardToDeck,
  listDecksContainingOracle,
  setCardQuantity,
} from "./deckService";
import {
  addOracleToDrawer,
  drawersContainingOracle,
  removeOracleFromDrawer,
} from "./drawerService";

export type GroupKind = "deck" | "drawer" | "collection";

export type MembershipMeasure = {
  kind: GroupKind;
  groupId: string;
  groupName: string;
  /** Quantity for decks/collections with counters; tier for drawers; 1 for presence-only. */
  measure: number;
  /** Human label for the measure (e.g. "×2", "tier 1", "✓"). */
  label: string;
  board?: DeckBoard;
  drawerCardId?: string;
};

export type CardIdentity = {
  oracleId: string;
  scryfallId?: string | null;
  name: string;
};

/**
 * Unified presence across decks, drawers, and collections for one card.
 * Used by inspector tabs, context menu, and search results.
 */
export async function listMembershipsForCard(
  userId: string,
  card: CardIdentity
): Promise<MembershipMeasure[]> {
  const oracle = card.oracleId.toLowerCase();
  const out: MembershipMeasure[] = [];

  const [decks, drawers, collections] = await Promise.all([
    listDecksContainingOracle(userId, oracle),
    drawersContainingOracle(userId, oracle),
    listCollectionsContainingCard(userId, { id: card.scryfallId || oracle, oracle_id: oracle }),
  ]);

  for (const row of decks.rows) {
    out.push({
      kind: "deck",
      groupId: row.deck.id,
      groupName: row.deck.name,
      measure: row.quantity,
      label: `×${row.quantity}`,
      board: row.board,
    });
  }

  // drawersContainingOracle returns memberships; we need names
  const drawerNames = await drawerNameMap(userId);
  for (const m of drawers.memberships) {
    out.push({
      kind: "drawer",
      groupId: m.drawer_id,
      groupName: drawerNames.get(m.drawer_id) ?? "Drawer",
      measure: m.tier,
      label: `tier ${m.tier}`,
      drawerCardId: m.drawer_card_id,
    });
  }

  for (const row of collections.rows) {
    const qty = row.collection.quantity_counters ? row.quantity : 1;
    out.push({
      kind: "collection",
      groupId: row.collection.id,
      groupName: row.collection.name,
      measure: qty,
      label: row.collection.quantity_counters ? `×${qty}` : "✓",
    });
  }

  return out;
}

async function drawerNameMap(userId: string): Promise<Map<string, string>> {
  const { data } = await supabase.from("drawers").select("id, name").eq("user_id", userId);
  const map = new Map<string, string>();
  for (const d of data ?? []) {
    const row = d as { id: string; name: string };
    map.set(row.id, row.name);
  }
  return map;
}

/** Add or increment membership in a group. */
export async function addToGroup(
  kind: GroupKind,
  groupId: string,
  card: CardIdentity,
  opts?: { board?: DeckBoard; collection?: Collection }
): Promise<{ error: string | null }> {
  if (kind === "deck") {
    const { error } = await addCardToDeck(groupId, {
      oracle_id: card.oracleId,
      scryfall_id: card.scryfallId || card.oracleId,
      name: card.name,
      quantity: 1,
      board: opts?.board ?? "maybe",
    });
    return { error };
  }
  if (kind === "drawer") {
    return addOracleToDrawer(groupId, card.oracleId);
  }
  if (kind === "collection" && opts?.collection) {
    const { error } = await addCardToCollection(opts.collection, {
      id: card.scryfallId || card.oracleId,
      oracle_id: card.oracleId,
      name: card.name,
    });
    return { error };
  }
  return { error: "Unsupported group kind or missing context." };
}

/** Remove or decrement membership. */
export async function removeFromGroup(
  kind: GroupKind,
  groupId: string,
  card: CardIdentity,
  opts?: { collection?: Collection; deckCardId?: string }
): Promise<{ error: string | null }> {
  if (kind === "deck" && opts?.deckCardId) {
    const { error } = await setCardQuantity(opts.deckCardId, 0);
    return { error };
  }
  if (kind === "drawer") {
    return removeOracleFromDrawer(groupId, card.oracleId);
  }
  if (kind === "collection" && opts?.collection) {
    const { error } = await removeCardFromCollection(opts.collection, {
      id: card.scryfallId || card.oracleId,
      oracle_id: card.oracleId,
    });
    return { error };
  }
  return { error: "Unsupported group kind or missing context." };
}

export type { Deck, Drawer, Collection };
