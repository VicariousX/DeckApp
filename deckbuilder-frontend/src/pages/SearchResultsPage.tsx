import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CardResult } from "../components/CardResult";
import { ToolsMenu } from "../components/ToolsMenu";
import { useScryfallSearch } from "../hooks/useScryfallSearch";
import transitions from "../styles/pageTransitions.module.css";
import styles from "./SearchPage.module.css";
import resultStyles from "./SearchResultsPage.module.css";

const SIZE_DEFAULT = 240;
const SIZES = [15, 30, 50];

export function SearchResultsPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const mode = params.get("mode") === "advanced" ? "advanced" : "standard";
  const nParam = parseInt(params.get("n") ?? "30", 10);
  const pageSize = SIZES.includes(nParam) ? nParam : 30;
  const [cardSize, setCardSize] = useState(SIZE_DEFAULT);
  const [shown, setShown] = useState(pageSize);
  const { cards, total, hasMoreApi, isLoading, isError, run, loadMoreApi } =
    useScryfallSearch();

  useEffect(() => {
    void run(q);
    setShown(pageSize);
  }, [q, pageSize, run]);

  const visible = useMemo(() => cards.slice(0, shown), [cards, shown]);
  const canLocalMore = shown < cards.length;
  const canMore = canLocalMore || hasMoreApi;

  function setPageSize(n: number) {
    const next = new URLSearchParams(params);
    next.set("n", String(n));
    setParams(next, { replace: true });
    setShown(n);
  }

  async function loadNext() {
    if (canLocalMore) {
      setShown((s) => s + pageSize);
      return;
    }
    if (hasMoreApi) {
      await loadMoreApi();
      setShown((s) => s + pageSize);
    }
  }

  const editTo =
    mode === "advanced"
      ? `/search?mode=advanced&q=${encodeURIComponent(q)}`
      : `/search?mode=standard`;

  return (
    <div className={`${transitions.page} ${styles.page}`}>
      <ToolsMenu cardSize={cardSize} onCardSizeChange={setCardSize} />
      <div className={resultStyles.meta}>
        <Link to={editTo} className={resultStyles.back}>
          ← Edit {mode} search
        </Link>
        <p className={resultStyles.count}>
          {isLoading && cards.length === 0
            ? "Searching…"
            : isError
              ? "Search failed."
              : `${visible.length} of ${total || cards.length} on this page`}
        </p>
        <label className={resultStyles.size}>
          Batch
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
          >
            {SIZES.map((n) => (
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
      <CardResult cards={visible} cardSize={cardSize} />
      {canMore && !isError && (
        <div className={resultStyles.moreRow}>
          <button
            type="button"
            className={resultStyles.moreBtn}
            onClick={() => void loadNext()}
            disabled={isLoading}
          >
            {isLoading ? "Loading…" : "Load next batch"}
          </button>
        </div>
      )}
    </div>
  );
}
