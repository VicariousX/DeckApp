import { useState } from "react";
import { useScryfallSearch } from "../hooks/useScryfallSearch";
import { useDebounce } from "../hooks/useDebounce";
import { CardResult } from "./CardResult";
import type { Card } from "./CardResult";


export function CardSearch() {
  const [searchTerm, setSearchTerm] = useState("");

  const debouncedTerm = useDebounce(searchTerm, 300);

  const { data, isLoading, isError } = useScryfallSearch(debouncedTerm);

  const cards: Card[] = data?.data ?? [];

  return (
    <div style={{ padding: "1rem" }}>
      <input
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        placeholder="Search for a card..."
        style={{ padding: "0.5rem", width: "300px" }}
      />

      {isLoading && <p>Loading…</p>}
      {isError && <p>Something went wrong.</p>}

      {cards.map((card) => (
        <CardResult key={card.id} card={card} />
      ))}
    </div>
  );
}
