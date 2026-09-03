import { useState } from "react";
import { useDebounce } from "../hooks/useDebounce";
import { useScryfallSearch } from "../hooks/useScryfallSearch";

import type { ScryfallCard } from "../types/scryfall";

import styles from "./CardSearch.module.css";



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
    <div className={styles.searchContainer}>
      <input
       className={styles.searchInput}
       value={searchTerm}
       onChange={(e) => setSearchTerm(e.target.value)}
       placeholder="Search for a card..."
      />


      {isLoading && <p>Loading…</p>}
      {isError && <p>Something went wrong.</p>}

      {/* Search Results */}
      <div className={styles.resultsGrid}>
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
