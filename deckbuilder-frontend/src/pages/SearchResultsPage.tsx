import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CardResult } from "../components/CardResult";
import { ToolsMenu } from "../components/ToolsMenu";
import { useScryfallSearch } from "../hooks/useScryfallSearch";
import { extractMechanicTerms } from "../lib/mechanics/search";
import { oracleIdsForMechanic } from "../services/mechanicMarkService";
import { fetchCollectionByIds } from "../lib/scryfallApi";
import type { ScryfallCard } from "../types/scryfallCard";
import transitions from "../styles/pageTransitions.module.css";
import styles from "./SearchPage.module.css";
import resultStyles from "./SearchResultsPage.module.css";

const SIZE_DEFAULT = 240;
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
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const mechParsed = useMemo(() => extractMechanicTerms(q), [q]);
  const scryfallQ = mechParsed.rest || (mechParsed.terms.length ? "" : q);
  const [mechCards, setMechCards] = useState<ScryfallCard[]>([]);
  const [mechIds, setMechIds] = useState<Set<string> | null>(null);
  const mode = params.get("mode") === "advanced" ? "advanced" : "standard";
  const nParam = parseInt(params.get("n") ?? "30", 10);
  const pageSize = PAGE_SIZES.includes(nParam) ? nParam : 30;
  const sortKey = params.get("sort") || "name";
  const sortDir = params.get("dir") === "desc" ? "desc" : "asc";
  const viewPage = Math.max(1, parseInt(params.get("page") ?? "1", 10) || 1);
  const [cardSize, setCardSize] = useState(SIZE_DEFAULT);
  const [viewMode, setViewMode] = useState<"image" | "text">("image");
  const { cards, total, hasMoreApi, apiPage, isLoading, isError, run, goApiPage } =
    useScryfallSearch();

  const apiOrder = SCRYFALL_ORDER.has(sortKey) ? sortKey : "";

  useEffect(() => {
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

  return (
    <div className={`${transitions.page} ${styles.page}`}>
      <ToolsMenu cardSize={cardSize} onCardSizeChange={setCardSize} />
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
      <CardResult
        cards={visible}
        cardSize={cardSize}
        viewMode={viewMode}
        previewFirst
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
