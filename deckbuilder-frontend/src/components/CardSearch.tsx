import { useState, useEffect } from "react";

import styles from "./CardSearch.module.css";
import { useScryfallSearch } from "../hooks/useScryfallSearch";

import type { ScryfallCard } from "../types/scryfallCard";

export function CardSearch({
  onResults
}: {
  onResults: (cards: ScryfallCard[]) => void;
}) {
  const [inputValue, setInputValue] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  // Run the Scryfall search only when Enter is pressed
  const { cards, isLoading, isError } = useScryfallSearch(searchTerm);

  // ✔ Push results upward ONLY when cards change
  useEffect(() => {
    onResults(cards);
  }, [cards, onResults]);

  return (
    <div className={styles.searchContainer}>
      {/* Search Bar */}
      <div className={styles.searchBar}>
        <input
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setSearchTerm(""); // clears results while typing
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              setSearchTerm(inputValue); // run search only on Enter
            }
          }}
          placeholder="Search for a card..."
          className={styles.searchInput}
        />

        {searchTerm === "" && inputValue !== "" && (
          <div className={styles.searchHint}>Press Enter to search</div>
        )}
      </div>

      {/* Loading / Error */}
      {isLoading && <p className={styles.searchStatus}>Loading…</p>}
      {isError && (
        <p className={styles.searchStatusError}>Something went wrong.</p>
      )}

      {/* Hero Section (before first search) */}
      {searchTerm === "" && (
        <div className={styles.hero}>
          <h1 className={styles.heroTitle}>Search Magic Cards</h1>
          <p className={styles.heroSubtitle}>
            Type a card name and press Enter to begin.
          </p>
        </div>
      )}

      {/* Placeholder Grid (before first search) */}
      {searchTerm === "" && (
        <div className={styles.placeholderGrid}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className={styles.placeholderCard} />
          ))}
        </div>
      )}
    </div>
  );
}
