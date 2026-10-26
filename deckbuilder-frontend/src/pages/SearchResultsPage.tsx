import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import {
  addCardToCollection,
  listCollectionCards,
  listMyCollections,
  removeCardFromCollection,
} from "../services/collectionService";
import { addCardToDeck } from "../services/deckService";
import {
  addOracleToDrawer,
  fetchDrawerCards,
  removeOracleFromDrawer,
} from "../services/drawerService";
import { ensureUserCardFromScryfall } from "../services/userCardService";
import { loadSearchTargets, type SearchTargetRef } from "../services/searchTargetService";
import { fetchDeckDetail } from "../services/deckService";
import { CardTile } from "../components/CardTile";
import { CardResult } from "../components/CardResult";
import { ToolsMenu } from "../components/ToolsMenu";
import { useSearchStream } from "../hooks/useSearchStream";
import type { ScryfallCard } from "../types/scryfallCard";
import transitions from "../styles/pageTransitions.module.css";
import styles from "./SearchPage.module.css";
import resultStyles from "./SearchResultsPage.module.css";

const PAGE_SIZES = [15, 30, 50];

const SCRYFALL_ORDER = new Set([
  "name",
  "set",
  "released",
  "rarity",
  "color",
  "usd",
  "tix",
  "eur",
  "cmc",
  "power",
  "toughness",
  "artist",
  "edhrec",
]);

const SORT_OPTIONS: { key: string; label: string }[] = [
  { key: "name", label: "Name" },
  { key: "cmc", label: "Mana value" },
  { key: "mana_cost", label: "Mana cost" },
  { key: "type_line", label: "Type" },
  { key: "oracle_text", label: "Oracle text" },
  { key: "colors", label: "Colors" },
  { key: "color_identity", label: "Color identity" },
  { key: "power", label: "Power" },
  { key: "toughness", label: "Toughness" },
  { key: "loyalty", label: "Loyalty" },
  { key: "set", label: "Set code" },
  { key: "set_name", label: "Set name" },
  { key: "released", label: "Released" },
  { key: "rarity", label: "Rarity" },
  { key: "collector_number", label: "Collector #" },
  { key: "artist", label: "Artist" },
  { key: "layout", label: "Layout" },
  { key: "frame", label: "Frame" },
  { key: "border_color", label: "Border" },
  { key: "lang", label: "Language" },
  { key: "edhrec", label: "EDHREC rank" },
  { key: "usd", label: "USD" },
  { key: "eur", label: "EUR" },
  { key: "tix", label: "TIX" },
  { key: "keywords", label: "Keywords" },
];

function attr(card: ScryfallCard, key: string): string | number {
  switch (key) {
    case "released":
      return card.released_at ?? "";
    case "edhrec":
      return card.edhrec_rank ?? 999999;
    case "usd":
      return parseFloat(card.prices?.usd ?? "NaN");
    case "eur":
      return parseFloat(card.prices?.eur ?? "NaN");
    case "tix":
      return parseFloat(card.prices?.tix ?? "NaN");
    case "colors":
      return (card.colors ?? []).join("");
    case "color_identity":
      return (card.color_identity ?? []).join("");
    case "keywords":
      return (card.keywords ?? []).join(" ");
    case "color":
      return (card.colors ?? []).join("");
    default: {
      const v = (card as unknown as Record<string, unknown>)[key];
      if (typeof v === "number") return v;
      if (Array.isArray(v)) return v.join(" ");
      return v == null ? "" : String(v);
    }
  }
}

export function SearchResultsPage() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [browseMode, setBrowseMode] = useState<"text" | "catalog" | "scroll">("catalog");
  const lastMode = useRef<"text" | "catalog">("catalog");
  const [targets, setTargets] = useState<SearchTargetRef[]>([]);
  const [targetKey, setTargetKey] = useState("");
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [presenceOnly, setPresenceOnly] = useState(false);
  const [showTargetChip, setShowTargetChip] = useState(true);
  const target = targets.find((t) => `${t.kind}:${t.id}` === targetKey) ?? null;

  useEffect(() => {
    if (!user) return;
    void loadSearchTargets(user.id).then((list) => {
      setTargets(list);
      setTargetKey((cur) => cur || (list[0] ? `${list[0].kind}:${list[0].id}` : ""));
    });
  }, [user]);

  useEffect(() => {
    if (!user || !target) {
      setCounts({});
      return;
    }
    let cancel = false;
    void (async () => {
      if (target.kind === "collection") {
        const { collections } = await listMyCollections(user.id);
        const collection = collections.find((c) => c.id === target.id);
        setPresenceOnly(collection ? !collection.quantity_counters : false);
        const rows = await listCollectionCards(target.id);
        if (cancel) return;
        const next: Record<string, number> = {};
        for (const row of rows) next[row.identity] = row.quantity;
        setCounts(next);
      } else if (target.kind === "drawer") {
        setPresenceOnly(false);
        const { cards: rows } = await fetchDrawerCards(target.id, user.id);
        if (cancel) return;
        const next: Record<string, number> = {};
        for (const row of rows) next[row.oracle_id] = row.tier ?? 1;
        setCounts(next);
      } else if (target.kind === "deck") {
        setPresenceOnly(false);
        const { detail } = await fetchDeckDetail(target.id);
        if (cancel) return;
        const next: Record<string, number> = {};
        for (const row of detail?.cards ?? []) {
          const key = row.oracle_id || row.scryfall_id;
          if (key) next[key] = (next[key] ?? 0) + (row.quantity ?? 1);
        }
        setCounts(next);
      } else {
        setPresenceOnly(false);
        setCounts({});
      }
    })();
    return () => {
      cancel = true;
    };
  }, [user, target?.kind, target?.id]);
  const q = params.get("q") ?? "";
  const mode = params.get("mode") === "advanced" ? "advanced" : "standard";
  const nParam = parseInt(params.get("n") ?? "30", 10);
  const pageSize = PAGE_SIZES.includes(nParam) ? nParam : 30;
  const sortKey = params.get("sort") || "name";
  const sortDir = params.get("dir") === "desc" ? "desc" : "asc";
  const viewPage = Math.max(1, parseInt(params.get("page") ?? "1", 10) || 1);
  const [columns, setColumns] = useState(() =>
    typeof window !== "undefined" && window.innerWidth <= 768 ? 2 : 5
  );
  const apiOrder = SCRYFALL_ORDER.has(sortKey) ? sortKey : "";
  const {
    scryfallQ,
    mechCards,
    mechIds,
    stream,
    cards,
    total,
    hasMoreApi,
    apiPage,
    isLoading,
    isError,
    errorMessage,
    goApiPage,
    scrollCards,
    scrollStartIndexFor,
  } = useSearchStream(q, apiOrder, sortDir);

  const sorted = useMemo(() => {
    const source = scryfallQ ? cards : mechCards.length ? mechCards : cards;
    const filtered =
      mechIds && scryfallQ
        ? source.filter((c) => mechIds.has((c.oracle_id || c.id).toLowerCase()) || mechIds.has(c.oracle_id || c.id))
        : source;
    const copy = [...filtered];
    copy.sort((a, b) => {
      const av = attr(a, sortKey);
      const bv = attr(b, sortKey);
      const an = typeof av === "number" && !Number.isNaN(av);
      const bn = typeof bv === "number" && !Number.isNaN(bv);
      let cmp = 0;
      if (an && bn) cmp = (av as number) - (bv as number);
      else cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
      return sortDir === "desc" ? -cmp : cmp;
    });
    return copy;
  }, [cards, mechCards, mechIds, scryfallQ, sortDir, sortKey]);

  const pagesHere = Math.max(1, Math.ceil(sorted.length / pageSize) || 1);
  const safePage = Math.min(viewPage, pagesHere);
  const visible = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);
  const start = sorted.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const end = Math.min(safePage * pageSize, sorted.length);

  function patch(next: Record<string, string>) {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(next)) p.set(k, v);
    setParams(p, { replace: true });
  }

  async function nextPage() {
    if (safePage < pagesHere) {
      patch({ page: String(safePage + 1) });
      return;
    }
    if (hasMoreApi) {
      await goApiPage(apiPage + 1);
      patch({ page: "1" });
    }
  }

  async function prevPage() {
    if (safePage > 1) {
      patch({ page: String(safePage - 1) });
      return;
    }
    if (apiPage > 1) {
      await goApiPage(apiPage - 1);
      patch({ page: "1" });
    }
  }

  const editTo =
    mode === "advanced"
      ? `/search?mode=advanced&q=${encodeURIComponent(q)}`
      : `/search?mode=standard`;

  const canPrev = safePage > 1 || apiPage > 1;
  const canNext = safePage < pagesHere || hasMoreApi;

  const resultCards = browseMode === "scroll" && scrollCards.length ? scrollCards : visible;

  const scrollStartIndex = useMemo(
    () => (browseMode === "scroll" ? scrollStartIndexFor(visible) : 0),
    [browseMode, scrollCards, visible]
  );

  return (
    <div className={`${transitions.page} ${styles.page}`}>
      <ToolsMenu
        targets={targets}
        targetKey={targetKey}
        onTargetChange={setTargetKey}
        showTargetChip={showTargetChip}
        onShowTargetChipChange={setShowTargetChip}
        columns={columns}
        onColumnsChange={setColumns}
      />
      <div className={resultStyles.meta}>
        <Link to={editTo} className={resultStyles.back}>
          ← Edit {mode} search
        </Link>
        <p className={resultStyles.count}>
          {isLoading
            ? "Searching…"
            : isError
              ? "Search failed."
              : `${start}–${end} of ${total || sorted.length}`}
        </p>
        {showTargetChip && (
          <span className={resultStyles.targetChip}>
            {target ? `${target.kind} · ${target.name}` : "No target"}
            <button type="button" aria-label="Hide target indicator" onClick={() => setShowTargetChip(false)}>
              ×
            </button>
          </span>
        )}
        <div className={resultStyles.toggles}>
          <button
            type="button"
            className={`${resultStyles.viewBtn}${browseMode === "text" ? ` ${resultStyles.viewOn}` : ""}`}
            onClick={() => {
              lastMode.current = "text";
              setBrowseMode("text");
            }}
          >
            Text
          </button>
          <button
            type="button"
            className={`${resultStyles.viewBtn}${browseMode === "catalog" ? ` ${resultStyles.viewOn}` : ""}`}
            onClick={() => {
              lastMode.current = "catalog";
              setBrowseMode("catalog");
            }}
          >
            Catalog
          </button>
          <button
            type="button"
            className={`${resultStyles.viewBtn}${browseMode === "scroll" ? ` ${resultStyles.viewOn}` : ""}`}
            onClick={() => setBrowseMode("scroll")}
          >
            Scroll
          </button>
        </div>
        <label className={resultStyles.size}>
          Sort
          <select
            value={sortKey}
            onChange={(e) => patch({ sort: e.target.value, page: "1" })}
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className={resultStyles.dirBtn}
          onClick={() => patch({ dir: sortDir === "asc" ? "desc" : "asc", page: "1" })}
        >
          {sortDir === "asc" ? "A → Z" : "Z → A"}
        </button>
        <label className={resultStyles.size}>
          Per page
          <select
            value={pageSize}
            onChange={(e) => patch({ n: e.target.value, page: "1" })}
          >
            {PAGE_SIZES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className={resultStyles.query}>
        <code>{q}</code>
      </p>
      {isError && (
        <p className={resultStyles.query}>
          Search failed{errorMessage ? `: ${errorMessage}` : "."} Edit the query and try again.
        </p>
      )}
      {!isLoading && !isError && sorted.length === 0 && (
        <p className={resultStyles.query}>No cards matched. <Link to={editTo}>Edit search</Link></p>
      )}
      <CardResult
        cards={resultCards}
        cardSize={240}
        columns={browseMode === "catalog" ? columns : undefined}
        viewMode={browseMode === "text" ? "text" : "image"}
        browseMode={browseMode === "scroll" ? "scroll" : "catalog"}
        scrollStartIndex={scrollStartIndex}
        onEnterScroll={() => setBrowseMode("scroll")}
        onExitScroll={() => setBrowseMode(lastMode.current)}
        onReachEnd={
          browseMode === "scroll" && hasMoreApi && !isLoading
            ? () => void goApiPage((stream.at(-1)?.page ?? apiPage) + 1)
            : undefined
        }
        onReachStart={
          browseMode === "scroll" && (stream[0]?.page ?? apiPage) > 1 && !isLoading
            ? () => void goApiPage((stream[0]?.page ?? apiPage) - 1)
            : undefined
        }
        presenceOnly={presenceOnly}
        countInDeck={(card) => {
          const key = card.oracle_id || card.id;
          return counts[key] ?? counts[card.id] ?? 0;
        }}
        onAddToDeck={target && user ? (card) => {
          const key = card.oracle_id || card.id;
          if (target.kind === "collection") {
            setCounts((m) => ({ ...m, [key]: presenceOnly ? 1 : (m[key] ?? 0) + 1 }));
            void listMyCollections(user.id).then(({ collections }) => {
              const collection = collections.find((c) => c.id === target.id);
              if (collection) void addCardToCollection(collection, card);
            });
          } else if (target.kind === "drawer") {
            setCounts((m) => ({ ...m, [key]: m[key] ?? 1 }));
            void ensureUserCardFromScryfall(user.id, card).then(({ card: uc }) => {
              if (uc) void addOracleToDrawer(target.id, uc.oracle_id);
            });
          } else {
            setCounts((m) => ({ ...m, [key]: (m[key] ?? 0) + 1 }));
            void addCardToDeck(target.id, {
              oracle_id: key,
              scryfall_id: card.id,
              name: card.name,
              type_line: card.type_line ?? "",
              quantity: 1,
              board: "maybe",
            });
          }
        } : undefined}
        onUndoAdd={target && user ? (card) => {
          const key = card.oracle_id || card.id;
          setCounts((m) => ({ ...m, [key]: Math.max(0, (m[key] ?? 1) - 1) }));
          if (target.kind === "collection") {
            void listMyCollections(user.id).then(({ collections }) => {
              const collection = collections.find((c) => c.id === target.id);
              if (collection) void removeCardFromCollection(collection, card);
            });
          } else if (target.kind === "drawer") {
            void removeOracleFromDrawer(target.id, key);
          }
        } : undefined}
        catalogTile={browseMode === "catalog" ? (card, _index, open, onContext) => {
          const key = card.oracle_id || card.id;
          const n = counts[key] ?? counts[card.id] ?? 0;
          const present = n > 0;
          const ear = !present
            ? undefined
            : target?.kind === "drawer"
              ? n
              : presenceOnly
                ? "✓"
                : n;
          const addMark = presenceOnly ? "✓" : "+";
          return (
            <CardTile
              face={{ name: card.name, imageUrl: card.image_uris?.normal, scryfallId: card.id, oracleId: card.oracle_id }}
              ear={ear}
              onOpen={open}
              onContextMenu={onContext}
              right={target ? [
                <button
                  key="add"
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    const add = target.kind === "collection"
                      ? () => {
                          setCounts((m) => ({ ...m, [key]: presenceOnly ? 1 : (m[key] ?? 0) + 1 }));
                          void listMyCollections(user!.id).then(({ collections }) => {
                            const collection = collections.find((c) => c.id === target.id);
                            if (collection) void addCardToCollection(collection, card);
                          });
                        }
                      : target.kind === "drawer"
                        ? () => {
                            setCounts((m) => ({ ...m, [key]: m[key] ?? 1 }));
                            void ensureUserCardFromScryfall(user!.id, card).then(({ card: uc }) => {
                              if (uc) void addOracleToDrawer(target.id, uc.oracle_id);
                            });
                          }
                        : () => {
                            setCounts((m) => ({ ...m, [key]: (m[key] ?? 0) + 1 }));
                            void addCardToDeck(target.id, {
                              oracle_id: key,
                              scryfall_id: card.id,
                              name: card.name,
                              type_line: card.type_line ?? "",
                              quantity: 1,
                              board: "maybe",
                            });
                          };
                    add();
                  }}
                  style={{ all: "unset", cursor: "pointer", width: "100%", textAlign: "center", fontWeight: 700 }}
                  aria-label="Add to target"
                >
                  {addMark}
                </button>,
              ] : undefined}
              bottom={target && present ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setCounts((m) => ({ ...m, [key]: Math.max(0, (m[key] ?? 1) - 1) }));
                    if (target.kind === "collection") {
                      void listMyCollections(user!.id).then(({ collections }) => {
                        const collection = collections.find((c) => c.id === target.id);
                        if (collection) void removeCardFromCollection(collection, card);
                      });
                    } else if (target.kind === "drawer") {
                      void removeOracleFromDrawer(target.id, key);
                    } else {
                      void addCardToDeck(target.id, {
                        oracle_id: key,
                        scryfall_id: card.id,
                        name: card.name,
                        type_line: card.type_line ?? "",
                        quantity: Math.max(0, n - 1),
                        board: "maybe",
                      });
                    }
                  }}
                  style={{ all: "unset", cursor: "pointer", width: "100%", textAlign: "center" }}
                  aria-label="Remove from target"
                >
                  Remove
                </button>
              ) : undefined}
            />
          );
        } : undefined}
      />
      <div className={resultStyles.moreRow}>
        <button
          type="button"
          className={resultStyles.moreBtn}
          disabled={!canPrev || isLoading}
          onClick={() => void prevPage()}
        >
          Previous
        </button>
        <span className={resultStyles.pageLabel}>Page {safePage}</span>
        <button
          type="button"
          className={resultStyles.moreBtn}
          disabled={!canNext || isLoading}
          onClick={() => void nextPage()}
        >
          {isLoading ? "Loading…" : "Next"}
        </button>
      </div>
    </div>
  );
}
