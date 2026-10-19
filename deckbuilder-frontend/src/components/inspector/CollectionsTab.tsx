import { useEffect, useState } from "react";
import { useAuth } from "../../auth/AuthProvider";
import {
  addCardToCollection,
  listCollectionsContainingCard,
  listMyCollections,
  removeCardFromCollection,
  type CollectionPresence,
} from "../../services/collectionService";
import type { Collection } from "../../types/collection";
import type { ScryfallCard } from "../../types/scryfallCard";
import styles from "../CardInspectorModal.module.css";

export function CollectionsTab({
  card,
  name,
}: {
  card: ScryfallCard | null;
  name: string;
}) {
  const { user } = useAuth();
  const [collections, setCollections] = useState<Collection[] | null>(null);
  const [presence, setPresence] = useState<CollectionPresence[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function reload() {
    if (!user || !card) return;
    const [{ collections: list }, { rows }] = await Promise.all([
      listMyCollections(user.id),
      listCollectionsContainingCard(user.id, card),
    ]);
    setCollections(list ?? []);
    setPresence(rows);
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, card?.id]);

  if (!card) {
    return <p className={styles.muted}>Load card to manage collections.</p>;
  }
  if (!user) {
    return <p className={styles.muted}>Sign in to track this card in collections.</p>;
  }

  const qtyFor = (c: Collection) =>
    presence.find((p) => p.collection.id === c.id)?.quantity ?? 0;
  const defaultCollection = collections?.find((c) => c.is_default) ?? null;

  async function add(collection: Collection) {
    setBusyId(collection.id);
    const { error } = await addCardToCollection(collection, card!);
    setBusyId(null);
    setStatus(error ?? `Added to ${collection.name}`);
    if (!error) await reload();
  }

  async function remove(collection: Collection) {
    setBusyId(collection.id);
    const { error } = await removeCardFromCollection(collection, card!);
    setBusyId(null);
    setStatus(error ?? `Removed from ${collection.name}`);
    if (!error) await reload();
  }

  return (
    <div className={`${styles.panelScroll} ${styles.panelScrollSolid}`}>
      <p className={styles.extraLabel}>{name} in collections</p>
      {status && <p className={styles.muted}>{status}</p>}
      {!collections && <p className={styles.muted}>Loading collections…</p>}
      {collections?.length === 0 && (
        <p className={styles.muted}>No collections yet.</p>
      )}
      <div className={styles.addDeckList}>
        {collections?.map((c) => {
          const qty = qtyFor(c);
          const label = c.quantity_counters
            ? qty > 0
              ? `×${qty}`
              : "Add"
            : qty > 0
              ? "✓"
              : "Add";
          return (
            <div key={c.id} className={styles.qtyRow}>
              <span>
                {c.name}
                {c.is_default ? " · default" : ""}
              </span>
              <div className={styles.qtyControls}>
                {c.quantity_counters && qty > 0 && (
                  <button
                    type="button"
                    className={styles.qtyBtn}
                    disabled={busyId === c.id}
                    onClick={() => void remove(c)}
                  >
                    −
                  </button>
                )}
                <button
                  type="button"
                  className={styles.addDeckBtn}
                  disabled={busyId === c.id || (!c.quantity_counters && qty > 0)}
                  onClick={() => void add(c)}
                >
                  {label}
                </button>
                {!c.quantity_counters && qty > 0 && (
                  <button
                    type="button"
                    className={styles.qtyBtn}
                    disabled={busyId === c.id}
                    onClick={() => void remove(c)}
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {defaultCollection && qtyFor(defaultCollection) === 0 && (
        <button
          type="button"
          className={styles.addDeckBtn}
          disabled={busyId === defaultCollection.id}
          onClick={() => void add(defaultCollection)}
        >
          Add to default
        </button>
      )}
    </div>
  );
}
