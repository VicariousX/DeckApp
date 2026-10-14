import { useEffect, useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import {
  createCollection,
  deleteCollection,
  ensureStarterCollections,
  listCollectionCards,
  updateCollection,
  type CollectionCard,
} from "../services/collectionService";
import type { Collection, CollectionInput, CollectionOwnership } from "../types/collection";
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

  if (!authLoading && !user) return <Navigate to="/login" replace />;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Collections</h1>
          <p className={styles.subtitle}>Owned cards, liked cards, and inventory.</p>
        </div>
        <button type="button" className={styles.primaryBtn} onClick={() => { setCreating(true); setDraft(EMPTY); }}>
          New collection
        </button>
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
              <ul className={styles.drawerList}>
                {cards.map((card) => (
                  <li key={card.id} className={styles.drawerItem}>
                    <span className={styles.drawerName}>{card.name}</span>
                    <span className={styles.drawerCount}>{selected.quantity_counters ? `×${card.quantity}` : "✓"}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
