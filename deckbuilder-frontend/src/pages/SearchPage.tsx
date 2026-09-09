import { useState } from "react";
import type { ScryfallCard } from "../types/scryfallCard";
import { CardSearch } from "../components/CardSearch";
import { CardResult } from "../components/CardResult";
import { ToolsMenu } from "../components/ToolsMenu";
import transitions from "../styles/pageTransitions.module.css";
import styles from "./SearchPage.module.css";

const SIZE_DEFAULT = 240;

export function SearchPage() {
  const [cards, setCards] = useState<ScryfallCard[]>([]);
  const [cardSize, setCardSize] = useState(SIZE_DEFAULT);

  return (
    <div className={`${transitions.page} ${styles.page}`}>
      <ToolsMenu cardSize={cardSize} onCardSizeChange={setCardSize} />
      <CardSearch onResults={setCards} />
      <CardResult cards={cards} cardSize={cardSize} />
    </div>
  );
}
