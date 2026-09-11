import { useEffect, useRef, useState, type KeyboardEvent } from "react";

import styles from "./CardSearch.module.css";
import { useScryfallSearch } from "../hooks/useScryfallSearch";
import { fetchAutocomplete } from "../lib/scryfallApi";

import type { ScryfallCard } from "../types/scryfallCard";

const GHOST_COUNT = 5;

export function CardSearch({
  onResults,
}: {
  onResults: (cards: ScryfallCard[]) => void;
}) {
  const [inputValue, setInputValue] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const wrapRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { cards, isLoading, isError } = useScryfallSearch(searchTerm);

  useEffect(() => {
    onResults(cards);
  }, [cards, onResults]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setSuggestOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = inputValue.trim();
    if (q.length < 2) {
      setSuggestions([]);
      setSuggestOpen(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSuggestLoading(true);
      const { names } = await fetchAutocomplete(q);
      setSuggestions(names.slice(0, 12));
      setSuggestLoading(false);
      setActiveIndex(-1);
      setSuggestOpen(names.length > 0);
    }, 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [inputValue]);

  function runSearch(term: string) {
    const t = term.trim();
    if (!t) return;
    setInputValue(t);
    setSearchTerm(t);
    setSuggestOpen(false);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      if (suggestions.length === 0) return;
      e.preventDefault();
      setSuggestOpen(true);
      setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0 && suggestions[activeIndex]) {
        runSearch(suggestions[activeIndex]);
      } else {
        runSearch(inputValue);
      }
    } else if (e.key === "Escape") {
      setSuggestOpen(false);
      setActiveIndex(-1);
    }
  }

  return (
    <div className={styles.searchContainer}>
      <div className={styles.searchBar} ref={wrapRef}>
        <div className={styles.inputWrap}>
          <input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={onKeyDown}
            onFocus={() => suggestions.length > 0 && setSuggestOpen(true)}
            placeholder="Search for a card…"
            className={styles.searchInput}
            autoComplete="off"
            spellCheck={false}
            role="combobox"
            aria-expanded={suggestOpen}
            aria-autocomplete="list"
            aria-controls="search-suggest-list"
          />
          {suggestLoading && (
            <span className={styles.spinner} aria-hidden />
          )}
          {suggestOpen && suggestions.length > 0 && (
            <ul
              id="search-suggest-list"
              className={styles.suggestList}
              role="listbox"
            >
              {suggestions.map((name, i) => (
                <li
                  key={name}
                  role="option"
                  aria-selected={i === activeIndex}
                >
                  <button
                    type="button"
                    className={
                      i === activeIndex
                        ? `${styles.suggestItem} ${styles.suggestItemActive}`
                        : styles.suggestItem
                    }
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => runSearch(name)}
                  >
                    {name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <p className={styles.searchHint}>
          Type to autocomplete · Enter to search · ↑↓ to navigate
        </p>
      </div>

      {isLoading && <p className={styles.searchStatus}>Loading…</p>}
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
