import { useState } from "react";
import type { ScryfallCard } from "../types/scryfallCard";
import { CardSearch } from "../components/CardSearch";
import { CardResult } from "../components/CardResult";
import transitions from "../styles/pageTransitions.module.css";

export function SearchPage() {
  const [cards, setCards] = useState<ScryfallCard[]>([]);

  return (
    <div className={transitions.page}>
      <CardSearch onResults={setCards} />
      <CardResult cards={cards} />
    </div>
  );
}
