import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { createDeck, deleteDeck, listMyDecks } from "../services/deckService";
import { hasBranches, pruneBranches } from "../services/deckHistory";
import {
  deleteFolder,
  loadFolderAssignments,
  loadFolders,
  saveFolders,
  setDeckFolder,
  type DeckFolder,
} from "../services/deckFolders";
import { BUILTIN_FORMATS } from "../lib/formats/rules";
import { loadHouseFormats } from "../services/houseFormatService";
import type { Deck } from "../types/deck";
import transitions from "../styles/pageTransitions.module.css";
import styles from "./MyDecksPage.module.css";

function FolderChoice({
  folder,
  folders,
  onPick,
}: {
  folder: DeckFolder;
  folders: DeckFolder[];
  onPick: (id: string) => void;
}) {
  const children = folders.filter((f) => f.parentId === folder.id);
  return (
    <div className={styles.menuItem}>
      <button type="button" onClick={() => onPick(folder.id)}>{folder.name}</button>
      {children.length > 0 && (
        <div className={styles.popout}>
          {children.map((child) => (
            <FolderChoice key={child.id} folder={child} folders={folders} onPick={onPick} />
          ))}
        </div>
      )}
    </div>
  );
}

export function MyDecksPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [decks, setDecks] = useState<Deck[]>([]);
  const [folders, setFolders] = useState<DeckFolder[]>([]);
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [folderName, setFolderName] = useState("");
  const [activeFolder, setActiveFolder] = useState<string>("all");
  const [activeSubfolder, setActiveSubfolder] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [format, setFormat] = useState("commander");
  const [houseFormats, setHouseFormats] = useState(loadHouseFormats());
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { decks: list, error: err } = await listMyDecks(user.id);
    setDecks(list);
    pruneBranches(new Set(list.map((d) => d.id)));
    setFolders(loadFolders(user.id));
    setAssignments(loadFolderAssignments(user.id));
    setError(err);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void reload();
    setHouseFormats(loadHouseFormats());
  }, [reload]);

  const roots = folders.filter((f) => !f.parentId);
  const subfolders = folders.filter((f) => f.parentId === activeFolder);
  function folderIdsAt(folderId: string): Set<string> {
    const ids = new Set<string>([folderId]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const folder of folders) {
        if (folder.parentId && ids.has(folder.parentId) && !ids.has(folder.id)) {
          ids.add(folder.id);
          grew = true;
        }
      }
    }
    return ids;
  }

  const visibleDecks = decks.filter((d) => {
    if (activeFolder === "all") return true;
    if (activeFolder === "unfiled") return !assignments[d.id];
    if (activeSubfolder) return assignments[d.id] === activeSubfolder;
    return folderIdsAt(activeFolder).has(assignments[d.id] ?? "");
  });

  if (!authLoading && !user) {
    return <Navigate to="/login" replace />;
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!user || !name.trim()) return;
    setBusy(true);
    setError(null);
    const { deck, error: err } = await createDeck(user.id, {
      name: name.trim(),
      format,
    });
    setBusy(false);
    if (err || !deck) {
      setError(err ?? "Could not create deck.");
      return;
    }
    setName("");
    navigate(`/deck/${deck.id}`);
  }

  function onCreateFolder(e: FormEvent) {
    e.preventDefault();
    if (!user || !folderName.trim()) return;
    const parentId = activeFolder !== "all" && activeFolder !== "unfiled" ? activeFolder : null;
    const next = [...folders, { id: crypto.randomUUID(), name: folderName.trim(), parentId }];
    saveFolders(user.id, next);
    setFolders(next);
    setFolderName("");
  }

  function onRemoveFolder(folder: DeckFolder) {
    if (!user || !confirm(`Delete folder “${folder.name}”? Decks stay in Unfiled.`)) return;
    deleteFolder(user.id, folder.id);
    setFolders(loadFolders(user.id));
    setAssignments(loadFolderAssignments(user.id));
  }

  function onMove(deckId: string, folderId: string) {
    if (!user) return;
    setDeckFolder(user.id, deckId, folderId || null);
    setAssignments(loadFolderAssignments(user.id));
  }

  async function onDelete(id: string, deckName: string) {
    if (!confirm(`Delete deck “${deckName}”? This cannot be undone.`)) return;
    const { error: err } = await deleteDeck(id);
    if (err) setError(err);
    else void reload();
  }

  function DeckRow({ deck }: { deck: Deck }) {
    const [open, setOpen] = useState(false);
    return (
      <li className={styles.deckItem}>
        <Link to={`/deck/${deck.id}`} className={styles.deckLink}>
          <span className={styles.deckName}>{deck.name}</span>
          <span className={styles.deckMeta}>
            {deck.format}
            {deck.is_public ? " · public" : " · private"}
          </span>
        </Link>
        <div className={styles.menuWrap}>
          <button
            type="button"
            className={styles.menuBtn}
            aria-label={`Options for ${deck.name}`}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            ⋯
          </button>
          {open && (
            <div className={styles.menu} onMouseLeave={() => setOpen(false)}>
              <div className={styles.menuItem}>
                Move to
                <div className={styles.popout}>
                  <button type="button" onClick={() => { onMove(deck.id, ""); setOpen(false); }}>Unfiled</button>
                  {roots.map((folder) => (
                    <FolderChoice
                      key={folder.id}
                      folder={folder}
                      folders={folders}
                      onPick={(id) => { onMove(deck.id, id); setOpen(false); }}
                    />
                  ))}
                </div>
              </div>
              {hasBranches(deck.id) && (
                <Link to={`/deck/${deck.id}/branches`} className={styles.menuLink}>View Branches</Link>
              )}
              <button type="button" className={styles.menuDanger} onClick={() => onDelete(deck.id, deck.name)}>
                Delete
              </button>
            </div>
          )}
        </div>
      </li>
    );
  }

  return (
    <div className={`${transitions.page} ${styles.page}`}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>My decks</h1>
          <p className={styles.subtitle}>Create decks, group them into folders, and open a branch tree from the menu.</p>
        </div>
      </header>

      <form className={styles.createCard} onSubmit={onCreate}>
        <h2 className={styles.createTitle}>New deck</h2>
        <div className={styles.createRow}>
          <input className={styles.input} placeholder="Deck name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required />
          <select className={styles.select} value={format} onChange={(e) => setFormat(e.target.value)} aria-label="Format">
            <option value="commander">Commander</option>
            {BUILTIN_FORMATS.filter((f) => f.id !== "commander").map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
            {houseFormats.map((f) => (
              <option key={f.id} value={`house:${f.id}`}>{f.name}</option>
            ))}
          </select>
          <button type="submit" className={styles.primaryBtn} disabled={busy}>{busy ? "Creating…" : "Create"}</button>
        </div>
      </form>

      <form className={styles.createCard} onSubmit={onCreateFolder}>
        <h2 className={styles.createTitle}>{activeFolder !== "all" && activeFolder !== "unfiled" ? "New subfolder" : "New folder"}</h2>
        <div className={styles.createRow}>
          <input className={styles.input} placeholder="Folder name" value={folderName} onChange={(e) => setFolderName(e.target.value)} maxLength={60} />
          <button type="submit" className={styles.primaryBtn}>
            {activeFolder !== "all" && activeFolder !== "unfiled" ? "Add subfolder" : "Add folder"}
          </button>
        </div>
      </form>

      {error && <p className={styles.error} role="alert">{error}</p>}
      {loading && <p className={styles.status}>Loading decks…</p>}

      <div className={styles.tabs} role="tablist" aria-label="Deck folders">
        <button type="button" className={`${styles.tab} ${activeFolder === "all" ? styles.tabOn : ""}`} onClick={() => { setActiveFolder("all"); setActiveSubfolder(""); }}>All</button>
        <button type="button" className={`${styles.tab} ${activeFolder === "unfiled" ? styles.tabOn : ""}`} onClick={() => { setActiveFolder("unfiled"); setActiveSubfolder(""); }}>Unfiled</button>
        {roots.map((folder) => (
          <button
            key={folder.id}
            type="button"
            className={`${styles.tab} ${activeFolder === folder.id ? styles.tabOn : ""}`}
            onClick={() => { setActiveFolder(folder.id); setActiveSubfolder(""); }}
          >
            {folder.name}
          </button>
        ))}
      </div>

      {subfolders.length > 0 && (
        <div className={styles.subTabs} role="tablist" aria-label="Subfolders">
          <button type="button" className={`${styles.subTab} ${!activeSubfolder ? styles.subTabOn : ""}`} onClick={() => setActiveSubfolder("")}>All</button>
          {subfolders.map((folder) => (
            <button
              key={folder.id}
              type="button"
              className={`${styles.subTab} ${activeSubfolder === folder.id ? styles.subTabOn : ""}`}
              onClick={() => setActiveSubfolder(folder.id)}
            >
              {folder.name}
            </button>
          ))}
        </div>
      )}

      {activeFolder !== "all" && activeFolder !== "unfiled" && (
        <div className={styles.folderHead}>
          <button type="button" className={styles.deleteBtn} onClick={() => onRemoveFolder(folders.find((f) => f.id === (activeSubfolder || activeFolder))!)}>
            Delete {activeSubfolder ? "subfolder" : "folder"}
          </button>
        </div>
      )}

      {!loading && visibleDecks.length === 0 && <p className={styles.empty}>No decks in this tab.</p>}
      <ul className={styles.list}>{visibleDecks.map((deck) => <DeckRow key={deck.id} deck={deck} />)}</ul>
    </div>
  );
}
