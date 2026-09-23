import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { useDraggablePanel } from "../../hooks/useDraggablePanel";
import { useNavigate } from "react-router-dom";
import { CATEGORIES, FIELD_TO_CATEGORY } from "../../lib/search/categories";
import { fieldAllowsSymbols, suggestionsFor } from "../../lib/search/autocomplete";
import {
  emptyGroup,
  parseQuery,
  serializeClause,
  serializeQuery,
  type Clause,
  type CmpOp,
  type Group,
  type Node,
  uid,
} from "../../lib/search/syntaxModel";
import { renderManaSymbol, renderTextWithSymbols } from "../../utils/symbols";
import { useAuth } from "../../auth/AuthProvider";
import {
  loadSearchCatalog,
  loadSearchTokens,
  saveSearchCatalog,
  saveSearchTokens,
  type SavedSearch,
  type SavedToken,
} from "../../services/searchTokenService";
import styles from "./AdvancedSearch.module.css";

const SYMBOLS = [
  { insert: "~", label: "~ name" },
  { insert: "{W}", label: "{W}" },
  { insert: "{U}", label: "{U}" },
  { insert: "{B}", label: "{B}" },
  { insert: "{R}", label: "{R}" },
  { insert: "{G}", label: "{G}" },
  { insert: "{C}", label: "{C}" },
  { insert: "{S}", label: "{S}" },
  { insert: "{X}", label: "{X}" },
  { insert: "{T}", label: "{T}" },
  { insert: "{Q}", label: "{Q}" },
  { insert: "{E}", label: "{E}" },
  { insert: "{P}", label: "{P}" },
];

const ALL_OPS: CmpOp[] = [":", "=", ">", "<", ">=", "<="];
const TEXT_OPS: CmpOp[] = [":"];
const NUM_OPS: CmpOp[] = [":", "=", ">", "<", ">=", "<="];

const SHORTCUTS: Record<string, string> = {
  n: "name",
  t: "t",
  o: "o",
  c: "c",
  i: "id",
  m: "m",
  v: "mv",
  p: "pow",
  r: "r",
  f: "f",
  a: "a",
  s: "s",
  k: "kw",
  e: "edhrec",
};

type Pin = { key: string; name: string };
const DEFAULT_PINS: Pin[] = [
  { key: "name", name: "name" },
  { key: "t", name: "t" },
  { key: "c", name: "c" },
  { key: "id", name: "id" },
  { key: "o", name: "o" },
  { key: "m", name: "m" },
  { key: "mv", name: "mv" },
];
const PIN_STORE = "deckapp.advPins";
const DRAWER_STORE = "deckapp.advTokenDrawer";
const CATALOG_STORE = "deckapp.searchCatalog";

function tokenKey(c: Clause): string {
  return serializeClause(c).trim().toLowerCase();
}

function loadLocalCatalog(): SavedSearch[] {
  try {
    const raw = localStorage.getItem(CATALOG_STORE);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedSearch[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function loadLocalDrawer(): SavedToken[] {
  try {
    const raw = localStorage.getItem(DRAWER_STORE);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedToken[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function loadPins(): Pin[] {
  try {
    const raw = localStorage.getItem(PIN_STORE);
    if (!raw) return DEFAULT_PINS;
    const parsed = JSON.parse(raw) as Pin[];
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_PINS;
    return parsed.filter((p) => p && typeof p.key === "string");
  } catch {
    return DEFAULT_PINS;
  }
}
const COLORS = [
  { id: "w", sym: "{W}" },
  { id: "u", sym: "{U}" },
  { id: "b", sym: "{B}" },
  { id: "r", sym: "{R}" },
  { id: "g", sym: "{G}" },
  { id: "c", sym: "{C}" },
];

function opsFor(opt?: FieldOpt | null): CmpOp[] {
  if (!opt) return TEXT_OPS;
  if (opt.ops && opt.ops.length) return opt.ops.filter((o) => o !== "!=");
  if (
    opt.category === "stats" ||
    opt.category === "prices" ||
    opt.category === "dates" ||
    opt.category === "edhrec" ||
    opt.key === "mv"
  ) {
    return NUM_OPS;
  }
  if (opt.category === "colors" || opt.key === "produces") return NUM_OPS;
  return TEXT_OPS;
}

function isColorField(opt?: FieldOpt | null) {
  return Boolean(opt && (opt.category === "colors" || opt.key === "produces"));
}

type FieldOpt = { category: string; key: string; label: string; group: string; hint?: string; ops?: CmpOp[] };

const FIELD_OPTS: FieldOpt[] = CATEGORIES.filter((c) => c.id !== "custom").flatMap((c) =>
  c.fields.map((f) => ({
    category: c.id,
    key: f.key,
    label: f.key ? `${f.key} · ${f.label}` : f.label,
    group: c.label,
    hint: f.hint,
    ops: f.ops,
  }))
);

type Draft = {
  category: string;
  field: string;
  op: CmpOp;
  excluded: boolean;
  value: string;
  editId?: string;
};

const EMPTY: Draft = { category: "", field: "", op: ":", excluded: false, value: "" };

function findNode(root: Group, id: string): { parent: Group; index: number } | null {
  const i = root.items.findIndex((n) => n.id === id);
  if (i >= 0) return { parent: root, index: i };
  for (const n of root.items) {
    if (n.kind === "group") {
      const hit = findNode(n, id);
      if (hit) return hit;
    }
  }
  return null;
}

function removeNode(root: Group, id: string): Group {
  return {
    ...root,
    items: root.items
      .filter((n) => n.id !== id)
      .map((n) => (n.kind === "group" ? removeNode(n, id) : n)),
  };
}

function containsId(node: Node, id: string): boolean {
  if (node.id === id) return true;
  return node.kind === "group" && node.items.some((n) => containsId(n, id));
}

function cloneClause(c: Clause): Clause {
  return { ...c, id: uid() };
}

function parseDragClause(dt: DataTransfer): Clause | null {
  const raw = dt.getData("application/x-deckapp-clause");
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Clause;
    if (!parsed || parsed.kind !== "clause") return null;
    return parsed;
  } catch {
    return null;
  }
}

function insertInto(root: Group, groupId: string, node: Node): Group {
  if (node.id === groupId) return root;
  if (node.kind === "group" && containsId(node, groupId)) return root;
  if (root.id === groupId) {
    if (root.items.some((n) => n.id === node.id)) return root;
    return { ...root, items: [...root.items, node] };
  }
  return {
    ...root,
    items: root.items.map((n) => (n.kind === "group" ? insertInto(n, groupId, node) : n)),
  };
}

function replaceNode(root: Group, id: string, next: Node): Group {
  return {
    ...root,
    items: root.items.map((n) => {
      if (n.id === id) return next;
      if (n.kind === "group") return replaceNode(n, id, next);
      return n;
    }),
  };
}

const STARTER_TOKENS: { field: string; category: string; op: CmpOp; value: string }[] = [
  { field: "t", category: "type", op: ":", value: "creature" },
  { field: "t", category: "type", op: ":", value: "instant" },
  { field: "t", category: "type", op: ":", value: "sorcery" },
  { field: "t", category: "type", op: ":", value: "artifact" },
  { field: "t", category: "type", op: ":", value: "enchantment" },
  { field: "t", category: "type", op: ":", value: "land" },
  { field: "t", category: "type", op: ":", value: "planeswalker" },
  { field: "is", category: "flags", op: ":", value: "commander" },
  { field: "f", category: "format", op: ":", value: "commander" },
  { field: "o", category: "text", op: ":", value: "draw" },
  { field: "o", category: "text", op: ":", value: "destroy" },
  { field: "o", category: "text", op: ":", value: "counter" },
  { field: "mv", category: "stats", op: "<=", value: "3" },
];

function makeSaved(clause: Clause, label?: string): SavedToken {
  const c = cloneClause(clause);
  return {
    id: uid(),
    label: label || serializeClause(c),
    clause: c,
    savedAt: Date.now(),
  };
}

export function AdvancedSearch({ initialQuery = "" }: { initialQuery?: string }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [root, setRoot] = useState<Group>(() => parseQuery(initialQuery, FIELD_TO_CATEGORY));
  const [bar, setBar] = useState(initialQuery);
  const [barDirty, setBarDirty] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const fieldBox = useRef<HTMLInputElement>(null);
  const valueBox = useRef<HTMLInputElement>(null);
  const [bench, setBench] = useState<Clause[]>([]);
  const [drawer, setDrawer] = useState<SavedToken[]>(loadLocalDrawer);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerQ, setDrawerQ] = useState("");
  const [drawerSort, setDrawerSort] = useState<"new" | "name">("new");
  const [catalog, setCatalog] = useState<SavedSearch[]>(loadLocalCatalog);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [searchName, setSearchName] = useState("");
  const [nameOpen, setNameOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [catalogEdit, setCatalogEdit] = useState(false);
  const catalogPanel = useDraggablePanel(catalogOpen, { w: 360, h: 380 });
  const drawerPanel = useDraggablePanel(drawerOpen, { w: 380, h: 420 });
  const [drawerEdit, setDrawerEdit] = useState(false);

  function persistDrawer(next: SavedToken[]) {
    setDrawer(next);
    try {
      localStorage.setItem(DRAWER_STORE, JSON.stringify(next));
    } catch {
      /* ignore */
    }
    void saveSearchTokens(user?.id ?? null, next);
  }

  function addTokenToDrawer(clause: Clause) {
    const key = tokenKey(clause);
    if (!key) return;
    if (drawer.some((t) => tokenKey(t.clause) === key)) return;
    persistDrawer([makeSaved(clause), ...drawer]);
    setDrawerOpen(true);
  }

  function persistCatalog(next: SavedSearch[]) {
    setCatalog(next);
    try {
      localStorage.setItem(CATALOG_STORE, JSON.stringify(next));
    } catch {
      /* ignore */
    }
    void saveSearchCatalog(user?.id ?? null, next);
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const remote = await loadSearchTokens(user?.id ?? null);
      if (cancelled || remote.length === 0) return;
      setDrawer((local) => {
        if (local.length === 0) {
          try {
            localStorage.setItem(DRAWER_STORE, JSON.stringify(remote));
          } catch {
            /* ignore */
          }
          return remote;
        }
        const seen = new Set(local.map((t) => tokenKey(t.clause)));
        const merged = [...local];
        for (const t of remote) {
          const k = tokenKey(t.clause);
          if (!k || seen.has(k)) continue;
          seen.add(k);
          merged.push(t);
        }
        try {
          localStorage.setItem(DRAWER_STORE, JSON.stringify(merged));
        } catch {
          /* ignore */
        }
        return merged;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const remote = await loadSearchCatalog(user?.id ?? null);
      if (cancelled || remote.length === 0) return;
      setCatalog((local) => {
        const seen = new Set(local.map((s) => s.query));
        const merged = [...local];
        for (const s of remote) {
          if (!seen.has(s.query)) merged.push(s);
        }
        try {
          localStorage.setItem(CATALOG_STORE, JSON.stringify(merged));
        } catch {
          /* ignore */
        }
        return merged;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const serialized = useMemo(() => serializeQuery(root), [root]);

  useEffect(() => {
    if (barDirty) return;
    setBar((prev) => (prev === serialized ? prev : serialized));
  }, [serialized, barDirty]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName;
      const typing = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
      if (e.key === "/" && !typing) {
        e.preventDefault();
        fieldBox.current?.focus();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        submit(barDirty ? validateBar() : bar);
      }
      if (e.key === "Escape") {
        setDraft(EMPTY);
        (document.activeElement as HTMLElement | null)?.blur();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bar, barDirty]);

  function pickField(opt: FieldOpt) {
    setDraft((d) => ({
      ...d,
      category: opt.category,
      field: opt.key,
      op: (opt.ops?.[0] ?? ":") as CmpOp,
    }));
    requestAnimationFrame(() => valueBox.current?.focus());
  }

  function commitDraft() {
    if (!draft.category || !draft.value.trim()) return;
    const clause: Clause = {
      kind: "clause",
      id: draft.editId ?? uid(),
      category: draft.category,
      field: draft.field,
      op: draft.op,
      value: draft.value.trim(),
      excluded: draft.excluded,
      joinAfter: "and",
    };
    setBarDirty(false);
    if (draft.editId) setRoot((r) => replaceNode(r, draft.editId!, clause));
    else setRoot((r) => ({ ...r, join: "and", items: [...r.items, clause] }));
    setDraft(EMPTY);
  }

  function validateBar() {
    const next = parseQuery(bar, FIELD_TO_CATEGORY);
    const locked = { ...next, join: "and" as const };
    setRoot(locked);
    const out = serializeQuery(locked);
    setBar(out);
    setBarDirty(false);
    return out;
  }

  function submit(q: string) {
    const trimmed = q.trim();
    if (!trimmed) return;
    navigate(`/search/results?mode=advanced&q=${encodeURIComponent(trimmed)}&n=30`);
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.liveBar}>
        <label className={styles.liveLabel} htmlFor="adv-live">
          Syntax
        </label>
        <input
          id="adv-live"
          className={styles.liveInput}
          value={bar}
          onChange={(e) => {
            setBarDirty(true);
            setBar(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            submit(barDirty ? validateBar() : bar);
          }}
          placeholder="t:creature (c:r or c:u)"
          spellCheck={false}
        />
        <button
          type="button"
          className={`${styles.iconBtn}${barDirty ? ` ${styles.iconHot}` : ""}`}
          disabled={!barDirty}
          onClick={() => validateBar()}
          title="Apply bar to board"
        >
          ✓
        </button>
        <button type="button" className={styles.primary} onClick={() => submit(barDirty ? validateBar() : bar)}>
          Search
        </button>
        <button
          type="button"
          className={styles.ghost}
          onClick={() => {
            setRoot(emptyGroup());
            setBar("");
            setBarDirty(false);
            setDraft(EMPTY);
          }}
        >
          Clear
        </button>
      </div>

      <div className={styles.saveRow}>
        <span ref={drawerPanel.anchorRef}>
          <button
            type="button"
            className={styles.ghost}
            onClick={() => setDrawerOpen((v) => !v)}
          >
            {drawerOpen ? "Close tokens" : `Tokens${drawer.length ? ` (${drawer.length})` : ""}`}
          </button>
        </span>
        <button
          type="button"
          className={styles.ghost}
          onClick={() => setNameOpen((v) => !v)}
          title="Search name"
        >
          {nameOpen ? "« Name" : "Name »"}
        </button>
        {nameOpen && (
          <input
            className={`${styles.value} ${styles.nameField}`}
            value={searchName}
            placeholder={editingId ? "Name (overwrite or save as new)" : "Name this search (optional)"}
            onChange={(e) => setSearchName(e.target.value)}
          />
        )}
        {editingId ? (
          <>
            <button
              type="button"
              className={styles.primary}
              disabled={!serialized.trim()}
              onClick={() => {
                const query = (barDirty ? validateBar() : serialized).trim();
                if (!query) return;
                persistCatalog(
                  catalog.map((x) =>
                    x.id === editingId
                      ? {
                          ...x,
                          name: searchName.trim() || x.name,
                          query,
                          savedAt: Date.now(),
                        }
                      : x
                  )
                );
                setEditingId(null);
              }}
            >
              Overwrite
            </button>
            <button
              type="button"
              className={styles.ghost}
              disabled={!serialized.trim()}
              onClick={() => {
                const query = (barDirty ? validateBar() : serialized).trim();
                if (!query) return;
                persistCatalog([
                  {
                    id: uid(),
                    name: searchName.trim() || query,
                    query,
                    savedAt: Date.now(),
                  },
                  ...catalog,
                ]);
                setEditingId(null);
                setSearchName("");
              }}
            >
              Save as new
            </button>
          </>
        ) : (
          <button
            type="button"
            className={styles.primary}
            disabled={!serialized.trim()}
            onClick={() => {
              const query = (barDirty ? validateBar() : serialized).trim();
              if (!query) return;
              if (catalog.some((s) => s.query === query)) return;
              persistCatalog([
                {
                  id: uid(),
                  name: searchName.trim() || query,
                  query,
                  savedAt: Date.now(),
                },
                ...catalog,
              ]);
              setSearchName("");
            }}
          >
            Save search
          </button>
        )}
        <span ref={catalogPanel.anchorRef}>
          <button
            type="button"
            className={styles.ghost}
            onClick={() => setCatalogOpen((v) => !v)}
          >
            {catalogOpen ? "Close catalog" : `Catalog${catalog.length ? ` (${catalog.length})` : ""}`}
          </button>
        </span>
      </div>

      {catalogOpen &&
        createPortal(
          <div
            className={styles.catalogPanel}
            ref={catalogPanel.panelRef}
            style={catalogPanel.panelStyle}
          >
            <div className={styles.catalogTop}>
              <div
                className={styles.catalogHandle}
                onPointerDown={catalogPanel.onHandlePointerDown}
              >
                Search catalog
              </div>
              <button
                type="button"
                className={styles.ghost}
                data-no-drag
                onClick={() => setCatalogOpen(false)}
              >
                ×
              </button>
            </div>
            <div className={styles.drawerBar}>
              <button
                type="button"
                className={catalogEdit ? styles.primary : styles.ghost}
                onClick={() => setCatalogEdit((v) => !v)}
              >
                {catalogEdit ? "Done" : "Edit"}
              </button>
            </div>
            <p className={styles.hint}>
              {catalogEdit
                ? "Click a search to load it for overwrite. Use × to delete."
                : "Click a search to load it."}
            </p>
            <div className={styles.catalogList}>
              {catalog.length === 0 && <p className={styles.hint}>No saved searches yet.</p>}
              {catalog.map((s) => (
                <div key={s.id} className={styles.savedRow}>
                  <button
                    type="button"
                    className={`${styles.token} ${editingId === s.id ? styles.iconHot : ""}`}
                    title={s.query}
                    onClick={() => {
                      const next = parseQuery(s.query, FIELD_TO_CATEGORY);
                      setRoot({ ...next, join: "and" });
                      setBar(s.query);
                      setBarDirty(false);
                      setSearchName(s.name);
                      setNameOpen(true);
                      if (catalogEdit) setEditingId(s.id);
                    }}
                  >
                    <code>{s.name}</code>
                  </button>
                  {catalogEdit && (
                    <button
                      type="button"
                      className={styles.ghost}
                      title="Delete"
                      onClick={() => {
                        persistCatalog(catalog.filter((x) => x.id !== s.id));
                        if (editingId === s.id) setEditingId(null);
                      }}
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
            <div
              className={styles.catalogResize}
              onPointerDown={catalogPanel.onResizePointerDown("se")}
            />
          </div>,
          document.body
        )}

      {drawerOpen &&
        createPortal(
          <div
            className={styles.catalogPanel}
            ref={drawerPanel.panelRef}
            style={drawerPanel.panelStyle}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const clause = parseDragClause(e.dataTransfer);
              if (clause) addTokenToDrawer(clause);
            }}
          >
            <div className={styles.catalogTop}>
              <div
                className={styles.catalogHandle}
                onPointerDown={drawerPanel.onHandlePointerDown}
              >
                Token drawer
              </div>
              <button
                type="button"
                className={styles.ghost}
                data-no-drag
                onClick={() => setDrawerOpen(false)}
              >
                ×
              </button>
            </div>
            <div className={styles.drawerBar}>
              <button
                type="button"
                className={drawerEdit ? styles.primary : styles.ghost}
                onClick={() => setDrawerEdit((v) => !v)}
              >
                {drawerEdit ? "Done" : "Edit"}
              </button>
              <button
                type="button"
                className={styles.ghost}
                onClick={() => {
                  const extras: SavedToken[] = [];
                  const have = new Set(drawer.map((t) => serializeClause(t.clause)));
                  for (const s of STARTER_TOKENS) {
                    const clause: Clause = {
                      kind: "clause",
                      id: uid(),
                      category: s.category,
                      field: s.field,
                      op: s.op,
                      value: s.value,
                      excluded: false,
                      joinAfter: "and",
                    };
                    const label = serializeClause(clause);
                    if (have.has(label)) continue;
                    extras.push(makeSaved(clause, label));
                  }
                  if (extras.length) persistDrawer([...extras, ...drawer]);
                }}
              >
                Starter tokens
              </button>
            </div>
            <div className={styles.drawerBar}>
              <input
                className={styles.value}
                value={drawerQ}
                placeholder="Filter saved tokens"
                onChange={(e) => setDrawerQ(e.target.value)}
              />
              <button
                type="button"
                className={styles.ghost}
                onClick={() => setDrawerSort((s) => (s === "new" ? "name" : "new"))}
              >
                {drawerSort === "new" ? "Newest" : "Name"}
              </button>
            </div>
            <div className={styles.catalogList}>
              {drawer
                .filter((s) => {
                  const q = drawerQ.toLowerCase();
                  if (!q) return true;
                  return (
                    s.label.toLowerCase().includes(q) ||
                    serializeClause(s.clause).toLowerCase().includes(q)
                  );
                })
                .sort((a, b) =>
                  drawerSort === "name"
                    ? a.label.localeCompare(b.label)
                    : b.savedAt - a.savedAt
                )
                .map((s) => (
                  <div key={s.id} className={styles.savedRow}>
                    <Token
                      clause={s.clause}
                      onEdit={() =>
                        setDraft({
                          category: s.clause.category,
                          field: s.clause.field,
                          op: s.clause.op,
                          excluded: s.clause.excluded,
                          value: s.clause.value,
                        })
                      }
                      onRemove={() => persistDrawer(drawer.filter((x) => x.id !== s.id))}
                      onApply={() =>
                        setRoot((r) => ({
                          ...r,
                          items: [...r.items, cloneClause(s.clause)],
                        }))
                      }
                      dragSrc="drawer"
                    />
                    {drawerEdit && (
                      <button
                        type="button"
                        className={styles.ghost}
                        title="Delete"
                        onClick={() => persistDrawer(drawer.filter((x) => x.id !== s.id))}
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
            </div>
            <div
              className={styles.catalogResize}
              onPointerDown={drawerPanel.onResizePointerDown("se")}
            />
          </div>,
          document.body
        )}

      <ClauseRow
        draft={draft}
        setDraft={setDraft}
        fieldBox={fieldBox}
        valueBox={valueBox}
        onPick={pickField}
        onSubmit={commitDraft}
      />

      <p className={styles.hint}>
        <kbd>/</kbd> field · <kbd>Enter</kbd> add token · <kbd>Ctrl</kbd>+<kbd>Enter</kbd> search · drag tokens into groups
      </p>

      <>
          <LogicBoard
            root={root}
            onChange={setRoot}
            onEdit={(c) => {
              setDraft({
                category: c.category,
                field: c.field,
                op: c.op,
                excluded: c.excluded,
                value: c.value,
                editId: c.id,
              });
              valueBox.current?.focus();
            }}
            onExtract={(c) => {
              setRoot((r) => removeNode(r, c.id));
              setBench((list) => (list.some((x) => x.id === c.id) ? list : [...list, c]));
            }}
            onSave={(c) => {
              addTokenToDrawer(c);
            }}
            onAdopt={(id, groupId, incoming) => {
              const fromBench = bench.find((x) => x.id === id);
              const fromDrawer = drawer.find((x) => x.id === id)?.clause;
              const src = fromBench || fromDrawer || incoming;
              if (!src) return;
              setRoot((r) => ({ ...insertInto(r, groupId, cloneClause(src)), join: "and" }));
            }}
          />
          <section
            className={styles.logic}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const clause = parseDragClause(e.dataTransfer);
              if (!clause) return;
              setBench((list) => [...list, cloneClause(clause)]);
            }}
          >
            <div className={styles.logicHead}>
              <h2>Bench</h2>
              <span className={styles.hint}>Held tokens are not in the query</span>
            </div>
            <div className={`${styles.bubble} ${styles.bubbleAnd}`}>
              <div className={styles.tokens}>
                {bench.map((c) => (
                  <Token
                    key={c.id}
                    clause={c}
                    onEdit={() => {
                      setDraft({
                        category: c.category,
                        field: c.field,
                        op: c.op,
                        excluded: c.excluded,
                        value: c.value,
                        editId: c.id,
                      });
                    }}
                    onRemove={() => setBench((list) => list.filter((x) => x.id !== c.id))}
                    onSave={() => {
                      persistDrawer([makeSaved(c), ...drawer]);
                      setDrawerOpen(true);
                    }}
                    onApply={() => {
                      setRoot((r) => ({ ...r, items: [...r.items, cloneClause(c)] }));
                    }}
                    dragSrc="bench"
                  />
                ))}
              </div>
            </div>
          </section>
      </>
    </div>
  );
}

function ClauseRow({
  draft,
  setDraft,
  fieldBox,
  valueBox,
  onPick,
  onSubmit,
}: {
  draft: Draft;
  setDraft: (d: Draft) => void;
  fieldBox: RefObject<HTMLInputElement | null>;
  valueBox: RefObject<HTMLInputElement | null>;
  onPick: (opt: FieldOpt) => void;
  onSubmit: () => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const [symOpen, setSymOpen] = useState(false);
  const [valueOpen, setValueOpen] = useState(false);
  const [pins, setPins] = useState<Pin[]>(loadPins);
  const [editPins, setEditPins] = useState(false);
  const pinPanel = useDraggablePanel(editPins, { w: 340, h: 320 });

  function savePins(next: Pin[]) {
    setPins(next);
    localStorage.setItem(PIN_STORE, JSON.stringify(next));
  }

  const selected = FIELD_OPTS.find((f) => f.category === draft.category && f.key === draft.field);
  const allowed = opsFor(selected);
  const q = query.toLowerCase();
  const filtered = FIELD_OPTS.filter(
    (f) => !q || f.label.toLowerCase().includes(q) || f.key.toLowerCase().includes(q) || f.group.toLowerCase().includes(q)
  );
  const groups = useMemo(() => {
    const map = new Map<string, FieldOpt[]>();
    for (const f of filtered) {
      const list = map.get(f.group) ?? [];
      list.push(f);
      map.set(f.group, list);
    }
    return [...map.entries()];
  }, [filtered]);

  const flat = filtered;
  const hints = suggestionsFor(draft.category, draft.field);
  const vq = draft.value.toLowerCase();
  const valueHints = hints.filter((h) => !vq || h.toLowerCase().includes(vq)).slice(0, 8);
  const symbols = fieldAllowsSymbols(draft.category, draft.field);
  const colorMode = isColorField(selected);

  function cycleOp(dir: 1 | -1) {
    const i = Math.max(0, allowed.indexOf(draft.op));
    const next = allowed[(i + dir + allowed.length) % allowed.length];
    setDraft({ ...draft, op: next });
  }

  function onComposerKey(e: ReactKeyboardEvent) {
    if (e.key === "ArrowLeft" && !e.altKey) {
      e.preventDefault();
      cycleOp(-1);
    } else if (e.key === "ArrowRight" && !e.altKey) {
      e.preventDefault();
      cycleOp(1);
    } else if (e.key === "-" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      setDraft({ ...draft, excluded: !draft.excluded });
    }
  }

  return (
    <section className={styles.composer}>
      <div className={styles.pins}>
        <span ref={pinPanel.anchorRef}>
          <button
            type="button"
            className={styles.pinEditBtn}
            onClick={() => setEditPins((v) => !v)}
            title="Edit quick fields"
          >
            ✎
          </button>
        </span>
        {pins.map((pin, i) => {
          const opt = FIELD_OPTS.find((f) => f.key === pin.key);
          if (!opt) return null;
          const on = draft.field === opt.key && draft.category === opt.category;
          return (
            <button
              key={`${pin.key}-${i}`}
              type="button"
              className={`${styles.pin}${on ? ` ${styles.opOn}` : ""}`}
              onClick={() => onPick(opt)}
            >
              {pin.name || opt.key || "n"}
            </button>
          );
        })}
      </div>
      {editPins &&
        createPortal(
          <div
            className={styles.catalogPanel}
            ref={pinPanel.panelRef}
            style={pinPanel.panelStyle}
          >
            <div className={styles.catalogTop}>
              <div className={styles.catalogHandle} onPointerDown={pinPanel.onHandlePointerDown}>
                Quick fields
              </div>
              <button type="button" className={styles.ghost} data-no-drag onClick={() => setEditPins(false)}>
                ×
              </button>
            </div>
            <div className={styles.catalogList}>
              {pins.map((pin, i) => (
                <div key={`${pin.key}-${i}`} className={styles.pinEdit}>
                  <select
                    value={pin.key}
                    onChange={(e) => {
                      const key = e.target.value;
                      const found = FIELD_OPTS.find((f) => f.key === key);
                      savePins(
                        pins.map((p, j) =>
                          j === i ? { key, name: found?.key || found?.label || key } : p
                        )
                      );
                    }}
                  >
                    {FIELD_OPTS.map((f) => (
                      <option key={`${f.category}:${f.key}`} value={f.key}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                  <input
                    value={pin.name}
                    onChange={(e) =>
                      savePins(pins.map((p, j) => (j === i ? { ...p, name: e.target.value } : p)))
                    }
                  />
                  <button type="button" onClick={() => savePins(pins.filter((_, j) => j !== i))}>
                    ×
                  </button>
                </div>
              ))}
              <button
                type="button"
                className={styles.pin}
                onClick={() => savePins([...pins, { key: "t", name: "t" }])}
              >
                +
              </button>
            </div>
            <div className={styles.catalogResize} onPointerDown={pinPanel.onResizePointerDown("se")} />
          </div>,
          document.body
        )}
      <div className={styles.row}>
        <div className={styles.fieldPick}>
          <input
            ref={fieldBox}
            className={styles.fieldInput}
            value={open ? query : selected?.label ?? query}
            placeholder="Field…  (type to filter)"
            onFocus={() => {
              setOpen(true);
              setQuery("");
            }}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
              setHi(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "Tab") {
                if (flat.length === 1) {
                  e.preventDefault();
                  onPick(flat[0]);
                  setOpen(false);
                  setQuery("");
                  requestAnimationFrame(() => valueBox.current?.focus());
                  return;
                }
                const code = (query || "").trim().toLowerCase();
                const mapped = SHORTCUTS[code];
                const hit =
                  (mapped && FIELD_OPTS.find((f) => f.key === mapped)) ||
                  FIELD_OPTS.find((f) => f.key === code);
                if (hit) {
                  e.preventDefault();
                  onPick(hit);
                  setOpen(false);
                  setQuery("");
                  requestAnimationFrame(() => valueBox.current?.focus());
                  return;
                }
                setOpen(false);
                return;
              }
              onComposerKey(e);
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setHi((i) => Math.min(i + 1, Math.max(flat.length - 1, 0)));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setHi((i) => Math.max(i - 1, 0));
              } else if (e.key === "Enter" && open && flat[hi]) {
                e.preventDefault();
                onPick(flat[hi]);
                setOpen(false);
                setQuery("");
              } else if (e.key === "Escape") {
                setOpen(false);
              }
            }}
            onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          />
          {open && (
            <div className={styles.menu} role="listbox">
              {groups.map(([group, items]) => (
                <div key={group}>
                  <div className={styles.menuGroup}>{group}</div>
                  {items.map((item) => {
                    const idx = flat.indexOf(item);
                    return (
                      <button
                        key={`${item.category}:${item.key}`}
                        type="button"
                        className={`${styles.menuItem}${idx === hi ? ` ${styles.menuOn}` : ""}`}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          onPick(item);
                          setOpen(false);
                          setQuery("");
                        }}
                      >
                        <code>{item.key || "name"}</code>
                        <span>{item.label.split(" · ").slice(-1)[0]}</span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          tabIndex={-1}
          className={`${styles.op}${draft.excluded ? ` ${styles.opOn}` : ""}`}
          onClick={() => setDraft({ ...draft, excluded: !draft.excluded })}
          title="Negate (Ctrl+-)"
        >
          −
        </button>

        <div className={styles.ops}>
          {ALL_OPS.map((o) => {
            const ok = allowed.includes(o);
            return (
              <button
                key={o}
                type="button"
                tabIndex={-1}
                disabled={!ok}
                className={`${styles.op}${draft.op === o ? ` ${styles.opOn}` : ""}${!ok ? ` ${styles.opOff}` : ""}`}
                onClick={() => ok && setDraft({ ...draft, op: o })}
              >
                {o}
              </button>
            );
          })}
        </div>

        <div className={styles.valueWrap}>
          {colorMode ? (
            <div className={styles.colorPick}>
              {COLORS.map((c) => {
                const on = draft.value.toLowerCase().includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    className={`${styles.colorBtn}${on ? ` ${styles.opOn}` : ""}`}
                    onClick={() => {
                      const letters = COLORS.map((x) => x.id).filter((id) =>
                        id === c.id ? !on : draft.value.toLowerCase().includes(id)
                      );
                      setDraft({ ...draft, value: letters.join("") });
                    }}
                  >
                    {renderManaSymbol(c.sym, 18)}
                  </button>
                );
              })}
            </div>
          ) : (
            <input
              ref={valueBox}
              className={styles.value}
              value={draft.value}
              placeholder={selected?.hint ?? "value"}
              onFocus={() => setValueOpen(true)}
              onChange={(e) => {
                setDraft({ ...draft, value: e.target.value });
                setValueOpen(true);
              }}
              onKeyDown={(e) => {
                onComposerKey(e);
                if (e.key === "Tab" && valueHints.length === 1) {
                  e.preventDefault();
                  setDraft({ ...draft, value: valueHints[0] });
                  setValueOpen(false);
                  return;
                }
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (valueHints.length === 1) {
                    setDraft({ ...draft, value: valueHints[0] });
                    setValueOpen(false);
                    return;
                  }
                  onSubmit();
                }
              }}
              onBlur={() => window.setTimeout(() => setValueOpen(false), 120)}
            />
          )}
          {symbols && !colorMode && (
            <button type="button" tabIndex={-1} className={styles.symBtn} onClick={() => setSymOpen((v) => !v)}>
              {"{ }"}
            </button>
          )}
          {symOpen && (
            <div className={styles.menu}>
              <button
                type="button"
                className={styles.menuItem}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setDraft({ ...draft, value: `${draft.value}~` });
                  setSymOpen(false);
                }}
              >
                ~ this name
              </button>
              {SYMBOLS.filter((s) => s.insert !== "~").map((s) => (
                <button
                  key={s.insert}
                  type="button"
                  className={styles.menuItem}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setDraft({ ...draft, value: `${draft.value}${s.insert}` });
                    setSymOpen(false);
                    valueBox.current?.focus();
                  }}
                >
                  {renderManaSymbol(s.insert, 18)}
                  <span>{s.insert}</span>
                </button>
              ))}
            </div>
          )}
          {valueOpen && valueHints.length > 0 && (
            <div className={styles.menu}>
              {valueHints.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={styles.menuItem}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setDraft({ ...draft, value: s });
                    setValueOpen(false);
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        <button type="button" className={styles.primary} disabled={!draft.value.trim()} onClick={onSubmit}>
          {draft.editId ? "Update" : "Add"}
        </button>
      </div>
    </section>
  );
}

function LogicBoard({
  root,
  onChange,
  onEdit,
  onExtract,
  onSave,
  onAdopt,
}: {
  root: Group;
  onChange: (g: Group | ((prev: Group) => Group)) => void;
  onEdit: (c: Clause) => void;
  onExtract: (c: Clause) => void;
  onSave: (c: Clause) => void;
  onAdopt?: (id: string, groupId: string, incoming?: Clause | null) => void;
}) {
  function patch(mut: (g: Group) => Group) {
    onChange((prev) => ({ ...mut(prev), join: "and" }));
  }
  function move(id: string, target: string, incoming?: Clause | null, src?: string) {
    if (id === target) return;
    onChange((prev) => {
      const loc = findNode(prev, id);
      if (!loc || src === "bench" || src === "drawer") {
        if (incoming) {
          return { ...insertInto(prev, target, cloneClause(incoming)), join: "and" };
        }
        onAdopt?.(id, target, incoming);
        return prev;
      }
      const node = loc.parent.items[loc.index];
      if (node.kind === "group" && containsId(node, target)) return prev;
      if (src === "board") {
        return { ...insertInto(removeNode(prev, id), target, node), join: "and" };
      }
      return { ...insertInto(prev, target, node.kind === "clause" ? cloneClause(node) : node), join: "and" };
    });
  }

  return (
    <section className={styles.logic}>
      <div className={styles.logicHead}>
        <h2>Board</h2>
      </div>
      <Bubble
        group={root}
        onEdit={onEdit}
        onMove={move}
        onPatch={patch}
        onExtract={onExtract}
        onSave={onSave}
        isRoot
      />
    </section>
  );
}

function Bubble({
  group,
  onEdit,
  onMove,
  onPatch,
  onExtract,
  onSave,
  isRoot,
}: {
  group: Group;
  onEdit: (c: Clause) => void;
  onMove: (id: string, groupId: string, incoming?: Clause | null, src?: string) => void;
  onPatch: (mut: (g: Group) => Group) => void;
  onExtract: (c: Clause) => void;
  onSave: (c: Clause) => void;
  isRoot?: boolean;
}) {
  return (
    <div
      className={`${styles.bubble} ${group.join === "or" ? styles.bubbleOr : styles.bubbleAnd}`}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const id = e.dataTransfer.getData("text/token");
        const src = e.dataTransfer.getData("text/token-src");
        const incoming = parseDragClause(e.dataTransfer);
        if (id) onMove(id, group.id, incoming, src);
      }}
    >
      <div className={styles.bubbleBar}>
        <button
          type="button"
          className={styles.joinMark}
          disabled={isRoot}
          onClick={() => {
            if (isRoot) return;
            onPatch((tree) =>
              replaceNode(tree, group.id, { ...group, join: group.join === "and" ? "or" : "and" })
            );
          }}
        >
          {isRoot ? "AND" : group.join.toUpperCase()}
        </button>
        <button
          type="button"
          className={styles.ghost}
          onClick={() =>
            onPatch((tree) => {
              if (isRoot || tree.id === group.id) {
                return { ...tree, items: [...tree.items, emptyGroup("or")] };
              }
              const loc = findNode(tree, group.id);
              const cur =
                loc && loc.parent.items[loc.index].kind === "group"
                  ? (loc.parent.items[loc.index] as Group)
                  : group;
              return replaceNode(tree, group.id, {
                ...cur,
                items: [...cur.items, emptyGroup("or")],
              });
            })
          }
        >
          + ( )
        </button>
        {!isRoot && (
          <button type="button" className={styles.ghost} onClick={() => onPatch((tree) => removeNode(tree, group.id))}>
            ×
          </button>
        )}
      </div>
      <div className={styles.tokens}>
        {group.items.map((n) =>
          n.kind === "clause" ? (
            <Token
              key={n.id}
              clause={n}
              onEdit={() => onEdit(n)}
              onRemove={() => onPatch((tree) => removeNode(tree, n.id))}
              onExtract={isRoot ? undefined : () => onExtract(n)}
              onSave={() => onSave(n)}
              dragSrc="board"
            />
          ) : (
            <div
              key={n.id}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData("text/token", n.id);
                e.stopPropagation();
              }}
            >
              <Bubble
                group={n}
                onEdit={onEdit}
                onMove={onMove}
                onPatch={onPatch}
                onExtract={onExtract}
                onSave={onSave}
              />
            </div>
          )
        )}
      </div>
    </div>
  );
}

function Token({
  clause,
  onEdit,
  onRemove,
  onExtract,
  onSave,
  onApply,
  dragSrc = "board",
}: {
  clause: Clause;
  onEdit: () => void;
  onRemove: () => void;
  onExtract?: () => void;
  onSave?: () => void;
  onApply?: () => void;
  dragSrc?: "board" | "bench" | "drawer";
}) {
  const syntax = serializeClause(clause);
  return (
    <div className={styles.tokenWrap}>
      <div
        className={`${styles.token}${clause.excluded ? ` ${styles.tokenNot}` : ""}`}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData("text/token", clause.id);
          e.dataTransfer.setData("text/token-src", dragSrc);
          e.dataTransfer.setData("application/x-deckapp-clause", JSON.stringify(clause));
          e.dataTransfer.effectAllowed = "copy";
        }}
      >
        <code>{renderTextWithSymbols(syntax, 14)}</code>
      </div>
      <span className={styles.tokenActs}>
        {onApply && (
          <button type="button" tabIndex={-1} data-skip-tab onClick={onApply} title="Add to query">
            +
          </button>
        )}
        {onExtract && (
          <button type="button" tabIndex={-1} data-skip-tab onClick={onExtract} title="Move to bench">
            ▴
          </button>
        )}
        {onSave && (
          <button type="button" tabIndex={-1} data-skip-tab onClick={onSave} title="Save to drawer">
            ☆
          </button>
        )}
        <button type="button" tabIndex={-1} data-skip-tab onClick={onEdit} title="Edit">
          ✎
        </button>
        <button type="button" tabIndex={-1} data-skip-tab onClick={onRemove} title="Remove">
          ×
        </button>
      </span>
    </div>
  );
}
