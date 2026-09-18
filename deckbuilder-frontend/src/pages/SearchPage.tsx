import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { ScryfallCard } from "../types/scryfallCard";
import { CardSearch } from "../components/CardSearch";
import { AdvancedSearch } from "../components/search/AdvancedSearch";
import { CardResult } from "../components/CardResult";
import { ToolsMenu } from "../components/ToolsMenu";
import transitions from "../styles/pageTransitions.module.css";
import styles from "./SearchPage.module.css";

const SIZE_DEFAULT = 240;

export function SearchPage() {
  const [params, setParams] = useSearchParams();
  const rawMode = params.get("mode");
  const mode =
    rawMode === "advanced"
      ? "advanced"
      : rawMode === "syntax" || rawMode === "standard"
        ? "standard"
        : "standard";
  const [cards, setCards] = useState<ScryfallCard[]>([]);
  const [cardSize, setCardSize] = useState(SIZE_DEFAULT);

  return (
    <div className={`${transitions.page} ${styles.page}`}>
      <ToolsMenu cardSize={cardSize} onCardSizeChange={setCardSize} />
      {mode === "advanced" ? (
        <AdvancedSearch
          initialQuery={params.get("q") ?? ""}
          onResults={setCards}
          onQueryChange={(q) => {
            const next = new URLSearchParams(params);
            next.set("mode", "advanced");
            if (q) next.set("q", q);
            else next.delete("q");
            setParams(next, { replace: true });
          }}
        />
      ) : (
        <CardSearch onResults={setCards} mode={mode} />
      )}
      <CardResult cards={cards} cardSize={cardSize} />
    </div>
  );
}
