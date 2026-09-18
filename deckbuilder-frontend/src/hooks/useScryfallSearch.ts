import { useCallback, useState } from "react";
import type { ScryfallCard } from "../types/scryfallCard";

type SearchJson = {
  data?: ScryfallCard[];
  total_cards?: number;
  has_more?: boolean;
};

export function useScryfallSearch() {
  const [cards, setCards] = useState<ScryfallCard[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMoreApi, setHasMoreApi] = useState(false);
  const [apiPage, setApiPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const [query, setQuery] = useState("");

  const run = useCallback(async (q: string) => {
    const trimmed = q.trim();
    setQuery(trimmed);
    setCards([]);
    setTotal(0);
    setApiPage(1);
    setHasMoreApi(false);
    if (!trimmed) return;
    setIsLoading(true);
    setIsError(false);
    try {
      const response = await fetch(
        `http://127.0.0.1:3001/api/scryfall?q=${encodeURIComponent(trimmed)}&page=1`
      );
      if (!response.ok) throw new Error("fail");
      const json: SearchJson = await response.json();
      setCards(json.data ?? []);
      setTotal(json.total_cards ?? json.data?.length ?? 0);
      setHasMoreApi(Boolean(json.has_more));
    } catch {
      setIsError(true);
      setCards([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadMoreApi = useCallback(async () => {
    if (!query || isLoading || !hasMoreApi) return;
    const next = apiPage + 1;
    setIsLoading(true);
    try {
      const response = await fetch(
        `http://127.0.0.1:3001/api/scryfall?q=${encodeURIComponent(query)}&page=${next}`
      );
      if (!response.ok) throw new Error("fail");
      const json: SearchJson = await response.json();
      setCards((prev) => [...prev, ...(json.data ?? [])]);
      setHasMoreApi(Boolean(json.has_more));
      setApiPage(next);
      if (json.total_cards) setTotal(json.total_cards);
    } catch {
      setIsError(true);
    } finally {
      setIsLoading(false);
    }
  }, [apiPage, hasMoreApi, isLoading, query]);

  return { cards, total, hasMoreApi, isLoading, isError, query, run, loadMoreApi };
}
