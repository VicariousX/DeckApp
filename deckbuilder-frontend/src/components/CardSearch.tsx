import { useState } from "react";
import { useDebounce } from "../hooks/useDebounce";
import { useScryfallSearch } from "../hooks/useScryfallSearch";

import type { ScryfallCard } from "../types/scryfall";




import { CardResult } from "./CardResult";
import { CardDetail } from "./CardDetail";
import { Modal } from "./Modal";

export function CardSearch() {
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedTerm = useDebounce(searchTerm, 300);

  const { data, isLoading, isError } = useScryfallSearch(debouncedTerm);

  const [selectedCard, setSelectedCard] = useState<ScryfallCard | null>(null);

  const cards: ScryfallCard[] = data?.data ?? [];

  return (
    <div style={{ padding: "1rem" }}>
      <input
       className="search-input"
       value={searchTerm}
       onChange={(e) => setSearchTerm(e.target.value)}
       placeholder="Search for a card..."
      />


      {isLoading && <p>Loading…</p>}
      {isError && <p>Something went wrong.</p>}

      {/* Search Results */}
      <div className="search-results">
        {cards.map((card) => (
          <CardResult
            key={card.id}
            card={card}
            onClick={() => setSelectedCard(card)}
          />
        ))}
      </div>

      {/* Modal for Card Detail */}
      {selectedCard && (
        <Modal onClose={() => setSelectedCard(null)}>
          <CardDetail card={selectedCard} />
        </Modal>
      )}
    </div>
  );
}
