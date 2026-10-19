import { useEffect, useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import {
  addCardToCollection,
  createCollection,
  deleteCollection,
  ensureStarterCollections,
  listCollectionCards,
  removeCardFromCollection,
  updateCollection,
  type CollectionCard,
} from "../services/collectionService";
import type { Collection, CollectionInput, CollectionOwnership } from "../types/collection";
import { DrawerCardTile, DrawerTileField } from "../components/DrawerCardTile";
import { CardInspectorModal } from "../components/CardInspectorModal";
import type { DrawerCardView } from "../types/drawer";
import styles from "./DrawersPage.module.css";

const EMPTY: CollectionInput = {
  name: "",
  ownership: "na",
  print_specific: false,
  quantity_counters: false,
  is_public: false,
  is_default: false,
};

function ownershipLabel(value: CollectionOwnership) {
  if (value === "physical") return "Physical";
  if (value === "digital") return "Digital";
  return "N/A";
}

export function CollectionsPage() {
  const { user, loading: authLoading } = useAuth();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [cards, setCards] = useState<CollectionCard[]>([]);
  const [draft, setDraft] = useState<CollectionInput>(EMPTY);
  const [creating, setCreating] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"text" | "image">("text");
  const [inspectId, setInspectId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    void ensureStarterCollections(user.id).then((list) => {
      setCollections(list);
      setSelectedId((id) => id ?? list.find((c) => c.is_default)?.id ?? list[0]?.id ?? null);
    });
  }, [user]);

  const selected = collections.find((c) => c.id === selectedId) ?? null;

  useEffect(() => {
    if (!selected) {
      setCards([]);
      return;
    }
    setDraft({
      name: selected.name,
      ownership: selected.ownership,
      print_specific: selected.print_specific,
      quantity_counters: selected.quantity_counters,
      is_public: selected.is_public,
      is_default: selected.is_default,
    });
    void listCollectionCards(selected.id).then(setCards);
  }, [selected?.id]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!user || !draft.name.trim()) return;
    const { collection, error } = await createCollection(user.id, draft);
    if (error || !collection) {
      setStatus(error);
      return;
    }
    const next = await ensureStarterCollections(user.id);
    setCollections(next);
    setSelectedId(collection.id);
    setCreating(false);
    setDraft(EMPTY);
  }

  async function saveSettings() {
    if (!user || !selected) return;
    const { error } = await updateCollection(user.id, selected.id, draft);
    if (error) {
      setStatus(error);
      return;
    }
    const refreshed = await ensureStarterCollections(user.id);
    setCollections(refreshed);
    setStatus("Saved.");
  }

  async function remove() {
    if (!user || !selected || !confirm(`Delete “${selected.name}”?`)) return;
    await deleteCollection(user.id, selected.id);
    const next = collections.filter((c) => c.id !== selected.id);
    setCollections(next);
    setSelectedId(next[0]?.id ?? null);
  }

  async function refreshCards() {
    if (!selected) return;
    setCards(await listCollectionCards(selected.id));
  }

  const inspectNav = cards.filter((c) => c.scryfall_id);
  const inspectIndex = inspectNav.findIndex((c) => c.id === inspectId);
  const inspectCard =
    inspectIndex >= 0
      ? inspectNav[inspectIndex]
      : cards.find((c) => c.id === inspectId) ?? null;

  if (!authLoading && !user) return <Navigate to="/login" replace />;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Collections</h1>
          <p className={styles.subtitle}>Owned cards, liked cards, and inventory.</p>
        </div>
        <div className={styles.headerTools}>
          <div className={styles.viewToggle} role="group" aria-label="Collection view mode">
            <button
              type="button"
              className={`${styles.viewBtn}${viewMode === "text" ? ` ${styles.viewBtnActive}` : ""}`}
              onClick={() => setViewMode("text")}
              aria-pressed={viewMode === "text"}
            >
              Text
            </button>
            <button
              type="button"
              className={`${styles.viewBtn}${viewMode === "image" ? ` ${styles.viewBtnActive}` : ""}`}
              onClick={() => setViewMode("image")}
              aria-pressed={viewMode === "image"}
            >
              Images
            </button>
          </div>
          <button type="button" className={styles.primaryBtn} onClick={() => { setCreating(true); setDraft(EMPTY); }}>
            New collection
          </button>
        </div>
      </header>
      {status && <p className={styles.muted}>{status}</p>}
      <div className={styles.layout}>
        <aside className={styles.sidebar}>
          <div className={styles.sidebarHead}>Your collections</div>
          <ul className={styles.drawerList}>
            {collections.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  className={`${styles.drawerItem}${c.id === selectedId ? ` ${styles.drawerItemActive}` : ""}`}
                  onClick={() => setSelectedId(c.id)}
                >
                  <span className={styles.drawerName}>{c.name}</span>
                  <span className={styles.drawerCountMeta}>
                    {c.is_default ? "Default" : ownershipLabel(c.ownership)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </aside>
        <section className={styles.main}>
          {creating && (
            <form className={styles.createForm} onSubmit={(e) => void onCreate(e)}>
              <input className={styles.input} value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} placeholder="Collection name" />
              <button type="submit" className={styles.primaryBtn}>Create</button>
            </form>
          )}
          {selected && (
            <>
              <h2 className={styles.drawerTitle}>{selected.name}</h2>
              <label className={styles.createForm}>
                <span>Name</span>
                <input className={styles.input} value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
              </label>
              <label className={styles.createForm}>
                <span>Ownership</span>
                <select className={styles.input} value={draft.ownership} onChange={(e) => setDraft((d) => ({ ...d, ownership: e.target.value as CollectionOwnership }))}>
                  <option value="physical">Physical</option>
                  <option value="digital">Digital</option>
                  <option value="na">N/A</option>
                </select>
              </label>
              <div className={styles.mainActions}>
                <label><input type="checkbox" checked={draft.print_specific} onChange={(e) => setDraft((d) => ({ ...d, print_specific: e.target.checked }))} /> Print specific</label>
                <label><input type="checkbox" checked={draft.quantity_counters} onChange={(e) => setDraft((d) => ({ ...d, quantity_counters: e.target.checked }))} /> Quantity counters</label>
                <label><input type="checkbox" checked={draft.is_public} onChange={(e) => setDraft((d) => ({ ...d, is_public: e.target.checked }))} /> Public</label>
                <label><input type="checkbox" checked={draft.is_default} onChange={(e) => setDraft((d) => ({ ...d, is_default: e.target.checked }))} /> Default target</label>
              </div>
              <div className={styles.mainActions}>
                <button type="button" className={styles.primaryBtn} onClick={() => void saveSettings()}>Save settings</button>
                <button type="button" className={styles.ghostBtn} onClick={() => void remove()}>Delete</button>
              </div>
              <p className={styles.muted}>{cards.length} cards</p>
              {viewMode === "image" ? (
                <DrawerTileField>
                  <div className={styles.tileGrid}>
                    {cards.map((card) => {
                      const tile: DrawerCardView = {
                        id: card.id,
                        drawer_id: card.collection_id,
                        oracle_id: card.oracle_id,
                        sort_order: 0,
                        tier: 1,
                        created_at: "",
                        name: card.name,
                        type_line: "",
                        mana_cost: null,
                        cmc: null,
                        color_identity: [],
                        imposed_color_identity: null,
                        useful_in: [],
                        effective_color_identity: [],
                        oracle_text: null,
                        image_url: card.image_url,
                        scryfall_id: card.scryfall_id,
                      };
                      return (
                        <DrawerCardTile
                          key={card.id}
                          card={tile}
                          showTierMark={false}
                          onOpen={() => {
                            if (card.scryfall_id) setInspectId(card.id);
                          }}
                          onRemove={() => {}}
                          onTier={() => {}}
                        />
                      );
                    })}
                  </div>
                </DrawerTileField>
              ) : (
                <ul className={styles.drawerList}>
                  {cards.map((card) => (
                    <li
                      key={card.id}
                      className={styles.drawerItem}
                      onClick={() => {
                        if (card.scryfall_id) setInspectId(card.id);
                      }}
                      style={{ cursor: card.scryfall_id ? "pointer" : undefined }}
                    >
                      <span className={styles.drawerName}>{card.name}</span>
                      <span className={styles.drawerCount}>{selected.quantity_counters ? `×${card.quantity}` : "✓"}</span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </section>
      </div>
      {inspectCard?.scryfall_id && selected && (
        <CardInspectorModal
          key={inspectCard.id}
          initialTab="collections"
          scryfallId={inspectCard.scryfall_id}
          name={inspectCard.name}
          imageUrl={inspectCard.image_url ?? undefined}
          onClose={() => setInspectId(null)}
          hasPrev={inspectIndex > 0}
          hasNext={inspectIndex >= 0 && inspectIndex < inspectNav.length - 1}
          onPrev={() => {
            if (inspectIndex > 0) setInspectId(inspectNav[inspectIndex - 1].id);
          }}
          onNext={() => {
            if (inspectIndex >= 0 && inspectIndex < inspectNav.length - 1) {
              setInspectId(inspectNav[inspectIndex + 1].id);
            }
          }}
          collection={{
            collectionName: selected.name,
            quantity: inspectCard.quantity,
            quantityCounters: selected.quantity_counters,
            onAdd: () => {
              void addCardToCollection(selected, {
                id: inspectCard.scryfall_id || inspectCard.oracle_id,
                oracle_id: inspectCard.oracle_id,
                name: inspectCard.name,
              }).then(() => refreshCards());
            },
            onRemove: () => {
              void removeCardFromCollection(selected, {
                id: inspectCard.scryfall_id || inspectCard.oracle_id,
                oracle_id: inspectCard.oracle_id,
              }).then(() => refreshCards());
            },
          }}
        />
      )}
    </div>
  );
}
