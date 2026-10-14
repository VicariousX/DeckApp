import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import {
  createCollection,
  deleteCollection,
  ensureStarterCollections,
  listMyCollections,
  updateCollection,
} from "../services/collectionService";
import type { Collection, CollectionInput, CollectionOwnership } from "../types/collection";
import styles from "./FormatsPage.module.css";

const EMPTY: CollectionInput = {
  name: "",
  ownership: "na",
  print_specific: false,
  quantity_counters: false,
  is_public: false,
  is_default: false,
};

function labelOwnership(value: CollectionOwnership) {
  if (value === "physical") return "Physical";
  if (value === "digital") return "Digital";
  return "N/A";
}

export function CollectionsPage() {
  const { user, loading: authLoading } = useAuth();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [draft, setDraft] = useState<CollectionInput>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    void ensureStarterCollections(user.id).then(setCollections);
  }, [user]);

  function startEdit(collection: Collection) {
    setEditingId(collection.id);
    setDraft({
      name: collection.name,
      ownership: collection.ownership,
      print_specific: collection.print_specific,
      quantity_counters: collection.quantity_counters,
      is_public: collection.is_public,
      is_default: collection.is_default,
    });
  }

  async function save() {
    if (!user || !draft.name.trim()) return;
    setBusy(true);
    const result = editingId
      ? await updateCollection(user.id, editingId, draft)
      : await createCollection(user.id, draft);
    setBusy(false);
    if (result.error) {
      setStatus(result.error);
      return;
    }
    const next = await listMyCollections(user.id);
    setCollections(next.collections);
    setDraft(EMPTY);
    setEditingId(null);
    setStatus(editingId ? "Collection updated." : "Collection created.");
  }

  async function remove(collection: Collection) {
    if (!user || !confirm(`Delete “${collection.name}”?`)) return;
    const { error } = await deleteCollection(user.id, collection.id);
    if (error) {
      setStatus(error);
      return;
    }
    setCollections((list) => list.filter((c) => c.id !== collection.id));
    if (editingId === collection.id) {
      setEditingId(null);
      setDraft(EMPTY);
    }
  }

  if (!authLoading && !user) {
    return (
      <div className={styles.page}>
        <h1 className={styles.title}>Collections</h1>
        <p className={styles.subtitle}>Sign in to create collections.</p>
        <Link to="/login" className={styles.primaryBtn}>Sign in</Link>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Collections</h1>
          <p className={styles.subtitle}>
            Group owned cards, liked cards, and inventory. Settings are chosen when you create a collection and can be edited later.
          </p>
        </div>
      </header>

      <section className={styles.form}>
        <h2 className={styles.formTitle}>{editingId ? "Edit collection" : "New collection"}</h2>
        <label className={styles.field}>
          <span>Name</span>
          <input
            className={styles.input}
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            placeholder="Liked Cards"
          />
        </label>
        <label className={styles.field}>
          <span>Ownership</span>
          <select
            className={styles.input}
            value={draft.ownership}
            onChange={(e) => setDraft((d) => ({ ...d, ownership: e.target.value as CollectionOwnership }))}
          >
            <option value="physical">Physical</option>
            <option value="digital">Digital</option>
            <option value="na">N/A</option>
          </select>
        </label>
        <div className={styles.toggles}>
          <label className={styles.toggle}>
            <input
              type="checkbox"
              checked={draft.print_specific}
              onChange={(e) => setDraft((d) => ({ ...d, print_specific: e.target.checked }))}
            />
            <span>Print specific</span>
          </label>
          <label className={styles.toggle}>
            <input
              type="checkbox"
              checked={draft.quantity_counters}
              onChange={(e) => setDraft((d) => ({ ...d, quantity_counters: e.target.checked }))}
            />
            <span>Quantity counters</span>
          </label>
          <label className={styles.toggle}>
            <input
              type="checkbox"
              checked={draft.is_public}
              onChange={(e) => setDraft((d) => ({ ...d, is_public: e.target.checked }))}
            />
            <span>Public</span>
          </label>
          <label className={styles.toggle}>
            <input
              type="checkbox"
              checked={draft.is_default}
              onChange={(e) => setDraft((d) => ({ ...d, is_default: e.target.checked }))}
            />
            <span>Default target</span>
          </label>
        </div>
        <p className={styles.status}>
          Print specific treats each printing or uploaded artwork as its own card. Quantity counters allow more than one of a card, for a physical inventory. Only one collection can be the default target.
        </p>
        <div className={styles.actions}>
          {editingId && (
            <button type="button" className={styles.deleteBtn} onClick={() => { setEditingId(null); setDraft(EMPTY); }}>
              Cancel
            </button>
          )}
          <button type="button" className={styles.primaryBtn} disabled={busy || !draft.name.trim()} onClick={() => void save()}>
            {editingId ? "Save changes" : "Create collection"}
          </button>
        </div>
        {status && <p className={styles.status}>{status}</p>}
      </section>

      <section className={styles.form}>
        <h2 className={styles.formTitle}>Your collections</h2>
        {collections.length === 0 && <p className={styles.empty}>No collections yet.</p>}
        {collections.map((collection) => (
          <div key={collection.id} className={styles.field}>
            <strong>{collection.name}</strong>
            <span>
              {labelOwnership(collection.ownership)}
              {collection.print_specific ? " · Print specific" : ""}
              {collection.quantity_counters ? " · Quantities" : ""}
              {collection.is_public ? " · Public" : " · Private"}
              {collection.is_default ? " · Default target" : ""}
            </span>
            <div className={styles.actions}>
              <button type="button" className={styles.primaryBtn} onClick={() => startEdit(collection)}>Edit</button>
              <button type="button" className={styles.deleteBtn} onClick={() => void remove(collection)}>Delete</button>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
