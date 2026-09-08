import { useEffect, useState } from "react";
import type { ScryfallCard } from "../types/scryfallCard";

interface ScryfallResponse {
  data: ScryfallCard[];
}

export function useScryfallSearch(query: string) {
  const [cards, setCards] = useState<ScryfallCard[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);

  // ✔ Handle empty query BEFORE the effect
  const trimmed = query.trim();
  const shouldSearch = trimmed.length > 0;

  useEffect(() => {
    let cancelled = false;

    // ✔ If no search term, do nothing (effect runs but does not set state)
    if (!shouldSearch) {
      return;
    }

    async function fetchCards() {
      setIsLoading(true);
      setIsError(false);

      try {
        const response = await fetch(
          `http://127.0.0.1:3001/api/scryfall?q=${encodeURIComponent(trimmed)}`
        );

        if (!response.ok) {
          throw new Error("Scryfall request failed");
        }

        const json: ScryfallResponse = await response.json();

        if (!cancelled) {
          setCards(json.data ?? []);
        }
      } catch {
        if (!cancelled) {
          setIsError(true);
          setCards([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchCards();

    return () => {
      cancelled = true;
    };
  }, [trimmed, shouldSearch]);

  // ✔ Empty query resets happen here (outside the effect)
  if (!shouldSearch && cards.length !== 0) {
    setCards([]);
  }

  return {
    cards,
    isLoading,
    isError
  };
}
