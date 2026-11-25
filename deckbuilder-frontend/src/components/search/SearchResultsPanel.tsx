import { useEffect, useMemo, useState } from "react";
import { CardResult } from "../CardResult";
import { CardTile } from "../CardTile";
import { useSearchStream } from "../../hooks/useSearchStream";
import { getFaceImage } from "../../utils/scryfall";
import type { ScryfallCard } from "../../types/scryfallCard";
import resultStyles from "../../pages/SearchResultsPage.module.css";

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
  { key: "type_line", label: "Type" },
  { key: "oracle_text", label: "Oracle text" },
  { key: "color_identity", label: "Color identity" },
  { key: "edhrec", label: "EDHREC rank" },
  { key: "released", label: "Released" },
  { key: "rarity", label: "Rarity" },
];

function attr(card: ScryfallCard, key: string): string | number {
  switch (key) {
    case "released":
      return card.released_at ?? "";
    case "edhrec":
      return card.edhrec_rank ?? 999999;
    case "color_identity":
      return (card.color_identity ?? []).join("");
    default: {
      const v = (card as unknown as Record<string, unknown>)[key];
      if (typeof v === "number") return v;
      if (Array.isArray(v)) return v.join(" ");
      return v == null ? "" : String(v);
    }
  }
}

export function SearchResultsPanel({
  query,
  onAddToDeck,
  countInDeck,
  onUndoAdd,
}: {
  query: string;
  onAddToDeck?: (card: ScryfallCard) => void;
  countInDeck?: (card: ScryfallCard) => number;
  onUndoAdd?: (card: ScryfallCard) => void;
}) {
  const [pageSize, setPageSize] = useState(30);
  const [sortKey, setSortKey] = useState("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [viewPage, setViewPage] = useState(1);
  const [viewMode, setViewMode] = useState<"image" | "text">("image");
  const [browseMode, setBrowseMode] = useState<"catalog" | "scroll">("catalog");
  const apiOrder = SCRYFALL_ORDER.has(sortKey) ? sortKey : "";
  const {
    mechParsed,
    mechCards,
    mechLoading,
    mechError,
    stream,
    cards,
    total,
    hasMoreApi,
    apiPage,
    isLoading,
    isError,
    goApiPage,
    scrollCards,
    scrollStartIndexFor,
  } = useSearchStream(query, apiOrder, sortDir);

  useEffect(() => {
    setViewPage(1);
  }, [query, apiOrder, sortDir]);

  const sorted = useMemo(() => {
    const source = mechParsed.terms.length ? mechCards : cards;
    const copy = [...source];
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
  }, [cards, mechCards, mechParsed.terms.length, sortDir, sortKey]);

  const searching = isLoading || mechLoading;
  const failed = isError || Boolean(mechError);
  const pagesHere = Math.max(1, Math.ceil(sorted.length / pageSize) || 1);
  const safePage = Math.min(viewPage, pagesHere);
  const visible = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);
  const start = sorted.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const end = Math.min(safePage * pageSize, sorted.length);
  const canPrev = mechParsed.terms.length ? safePage > 1 : safePage > 1 || apiPage > 1;
  const canNext = mechParsed.terms.length ? safePage < pagesHere : safePage < pagesHere || hasMoreApi;

  const resultCards = mechParsed.terms.length
    ? browseMode === "scroll"
      ? sorted
      : visible
    : browseMode === "scroll" && scrollCards.length
      ? scrollCards
      : stream.length
        ? stream.flatMap((p) => p.cards)
        : visible;

  const scrollStartIndex = useMemo(
    () => (browseMode === "scroll" ? scrollStartIndexFor(visible) : 0),
    [browseMode, scrollCards, visible]
  );

  if (!query.trim()) return null;

  return (
    <div>
      <div className={resultStyles.meta}>
        <p className={resultStyles.count}>
          {searching
            ? "Searching…"
            : failed
              ? "Search failed."
              : `${start}–${end} of ${mechParsed.terms.length ? sorted.length : total || sorted.length}`}
        </p>
        <div className={resultStyles.toggles}>
          <button
            type="button"
            className={`${resultStyles.viewBtn}${viewMode === "text" ? ` ${resultStyles.viewOn}` : ""}`}
            onClick={() => setViewMode("text")}
          >
            Text
          </button>
          <button
            type="button"
            className={`${resultStyles.viewBtn}${viewMode === "image" ? ` ${resultStyles.viewOn}` : ""}`}
            onClick={() => setViewMode("image")}
          >
            Images
          </button>
          <button
            type="button"
            className={`${resultStyles.viewBtn}${browseMode === "catalog" ? ` ${resultStyles.viewOn}` : ""}`}
            onClick={() => setBrowseMode("catalog")}
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
          <select value={sortKey} onChange={(e) => setSortKey(e.target.value)}>
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
          onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
        >
          {sortDir === "asc" ? "A → Z" : "Z → A"}
        </button>
        <label className={resultStyles.size}>
          Per page
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setViewPage(1);
            }}
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
        <code>{query}</code>
      </p>
      <CardResult
        countInDeck={countInDeck}
        onUndoAdd={onUndoAdd}
        cards={resultCards}
        scrollStartIndex={scrollStartIndex}
        onReachEnd={
          !mechParsed.terms.length && hasMoreApi && !searching
            ? () => void goApiPage((stream.at(-1)?.page ?? apiPage) + 1)
            : undefined
        }
        onReachStart={
          !mechParsed.terms.length && (stream[0]?.page ?? apiPage) > 1 && !searching
            ? () => void goApiPage((stream[0]?.page ?? apiPage) - 1)
            : undefined
        }
        cardSize={browseMode === "catalog" ? 200 : 180}
        viewMode={viewMode}
        browseMode={browseMode}
        onEnterScroll={() => setBrowseMode("scroll")}
        onExitScroll={() => setBrowseMode("catalog")}
        onAddToDeck={onAddToDeck}
        catalogTile={
          browseMode === "catalog"
            ? (card, _index, open, onContext) => {
                const key = card.oracle_id || card.id;
                const n = countInDeck?.(card) ?? 0;
                return (
                  <CardTile
                    face={{
                      name: card.name,
                      imageUrl: getFaceImage(card, 0),
                      scryfallId: card.id,
                      oracleId: card.oracle_id,
                    }}
                    ear={n > 0 ? n : undefined}
                    onOpen={open}
                    onContextMenu={onContext}
                    right={
                      onAddToDeck
                        ? [
                            <button
                              key="add"
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onAddToDeck(card);
                              }}
                              style={{ all: "unset", cursor: "pointer", width: "100%", textAlign: "center", fontWeight: 700 }}
                              aria-label="Add to deck"
                            >
                              +
                            </button>,
                          ]
                        : undefined
                    }
                    bottom={
                      onUndoAdd && n > 0 ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onUndoAdd(card);
                          }}
                          style={{ all: "unset", cursor: "pointer", width: "100%", textAlign: "center" }}
                          aria-label="Remove from deck"
                        >
                          Remove
                        </button>
                      ) : undefined
                    }
                  />
                );
              }
            : undefined
        }
      />
      <div className={resultStyles.moreRow}>
        <button
          type="button"
          className={resultStyles.moreBtn}
          disabled={!canPrev || searching}
          onClick={() => {
            if (safePage > 1) setViewPage(safePage - 1);
            else if (apiPage > 1) void goApiPage(apiPage - 1);
          }}
        >
          Previous
        </button>
        <span className={resultStyles.pageLabel}>Page {safePage}</span>
        <button
          type="button"
          className={resultStyles.moreBtn}
          disabled={!canNext || searching}
          onClick={() => {
            if (safePage < pagesHere) setViewPage(safePage + 1);
            else if (hasMoreApi) void goApiPage(apiPage + 1);
          }}
        >
          {searching ? "Loading…" : "Next"}
        </button>
      </div>
    </div>
  );
}
