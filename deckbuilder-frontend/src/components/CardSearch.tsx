import { useState, useEffect } from "react";

import styles from "./CardSearch.module.css";
import { useScryfallSearch } from "../hooks/useScryfallSearch";

import type { ScryfallCard } from "../types/scryfallCard";

const GHOST_COUNT = 6;

export function CardSearch({
  onResults
}: {
  onResults: (cards: ScryfallCard[]) => void;
}) {
  const [inputValue, setInputValue] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const { cards, isLoading, isError } = useScryfallSearch(searchTerm);

  useEffect(() => {
    onResults(cards);
  }, [cards, onResults]);

  return (
    <div className={styles.searchContainer}>
      <div className={styles.searchBar}>
        <input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              setSearchTerm(inputValue.trim());
            }
          }}
          placeholder="Search for a card..."
          className={styles.searchInput}
        />
      </div>

      {isLoading && <p className={styles.searchStatus}>Loading\u2026</p>}
      {isError && (
        <p className={styles.searchStatusError}>Something went wrong.</p>
      )}

      {searchTerm === "" && (
        <div className={styles.placeholderRow} aria-hidden>
          {Array.from({ length: GHOST_COUNT }).map((_, i) => (
            <div
              key={i}
              className={styles.placeholderCard}
              style={{
                opacity: 1 - i / GHOST_COUNT,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
