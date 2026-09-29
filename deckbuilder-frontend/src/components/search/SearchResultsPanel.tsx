import { useEffect, useMemo, useState } from "react";
import { CardResult } from "../CardResult";
import { useScryfallSearch } from "../../hooks/useScryfallSearch";
import { extractMechanicTerms } from "../../lib/mechanics/search";
import { oracleIdsForMechanic } from "../../services/mechanicMarkService";
import { fetchCollectionByIds } from "../../lib/scryfallApi";
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
}: {
  query: string;
  onAddToDeck?: (card: ScryfallCard) => void;
}) {
  const mechParsed = useMemo(() => extractMechanicTerms(query), [query]);
  const scryfallQ = mechParsed.rest || (mechParsed.terms.length ? "" : query);
  const [mechCards, setMechCards] = useState<ScryfallCard[]>([]);
  const [mechIds, setMechIds] = useState<Set<string> | null>(null);
  const [pageSize, setPageSize] = useState(30);
  const [sortKey, setSortKey] = useState("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [viewPage, setViewPage] = useState(1);
  const [viewMode, setViewMode] = useState<"image" | "text">("image");
  const { cards, total, hasMoreApi, apiPage, isLoading, isError, run, goApiPage } =
    useScryfallSearch();

  const apiOrder = SCRYFALL_ORDER.has(sortKey) ? sortKey : "";

  useEffect(() => {
    setViewPage(1);
    if (scryfallQ) void run(scryfallQ, apiOrder, sortDir);
  }, [scryfallQ, apiOrder, sortDir, run]);

  useEffect(() => {
    if (!mechParsed.terms.length) {
      setMechIds(null);
      setMechCards([]);
      return;
    }
    let cancel = false;
    void (async () => {
      const sets: string[][] = [];
      for (const t of mechParsed.terms) {
        const { ids } = await oracleIdsForMechanic(t.id, t.economy);
        sets.push(ids);
      }
      if (cancel) return;
      let acc = new Set(sets[0] ?? []);
      mechParsed.terms.forEach((t, i) => {
        const s = new Set(sets[i] ?? []);
        if (t.negate) acc = new Set([...acc].filter((id) => !s.has(id)));
        else if (i > 0) acc = new Set([...acc].filter((id) => s.has(id)));
      });
      setMechIds(acc);
      if (!scryfallQ && acc.size) {
        const { cards: found } = await fetchCollectionByIds([...acc].slice(0, 75));
        if (!cancel) setMechCards(found);
      } else setMechCards([]);
    })();
    return () => {
      cancel = true;
    };
  }, [mechParsed, scryfallQ]);

  const sorted = useMemo(() => {
    const source = scryfallQ ? cards : mechCards.length ? mechCards : cards;
    const filtered =
      mechIds && scryfallQ
        ? source.filter(
            (c) =>
              mechIds.has((c.oracle_id || c.id).toLowerCase()) ||
              mechIds.has(c.oracle_id || c.id)
          )
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
  const canPrev = safePage > 1 || apiPage > 1;
  const canNext = safePage < pagesHere || hasMoreApi;

  if (!query.trim()) return null;

  return (
    <div>
      <div className={resultStyles.meta}>
        <p className={resultStyles.count}>
          {isLoading
            ? "Searching…"
            : isError
              ? "Search failed."
              : `${start}–${end} of ${total || sorted.length}`}
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
        cards={visible}
        cardSize={180}
        viewMode={viewMode}
        onAddToDeck={onAddToDeck}
      />
      <div className={resultStyles.moreRow}>
        <button
          type="button"
          className={resultStyles.moreBtn}
          disabled={!canPrev || isLoading}
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
          disabled={!canNext || isLoading}
          onClick={() => {
            if (safePage < pagesHere) setViewPage(safePage + 1);
            else if (hasMoreApi) void goApiPage(apiPage + 1);
          }}
        >
          {isLoading ? "Loading…" : "Next"}
        </button>
      </div>
    </div>
  );
}
