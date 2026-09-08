import { useState } from "react";

import type { ScryfallCard } from "./types/scryfallCard";

import { CardSearch } from "./components/CardSearch";
import { CardResult } from "./components/CardResult";

import "./index.css";

export default function App() {
  const [cards, setCards] = useState<ScryfallCard[]>([]);

  return (
    <div className="app-root">
      <CardSearch onResults={setCards} />
      <CardResult cards={cards} />
    </div>
  );
}
