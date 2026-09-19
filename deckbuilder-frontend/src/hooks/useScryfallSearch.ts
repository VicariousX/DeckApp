import { useCallback, useState } from "react";
import { apiUrl } from "../lib/apiBase";
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
  const [order, setOrder] = useState("");
  const [dir, setDir] = useState<"asc" | "desc">("asc");

  const fetchPage = useCallback(
    async (
      q: string,
      page: number,
      ord: string,
      direction: "asc" | "desc"
    ) => {
      const trimmed = q.trim();
      if (!trimmed) {
        setCards([]);
        setTotal(0);
        return;
      }
      setIsLoading(true);
      setIsError(false);
      try {
        const qs = new URLSearchParams({
          q: trimmed,
          page: String(page),
        });
        if (ord) {
          qs.set("order", ord);
          qs.set("dir", direction);
        }
        const response = await fetch(
          apiUrl(`/api/scryfall?${qs.toString()}`)
        );
        if (!response.ok) throw new Error("fail");
        const json: SearchJson = await response.json();
        setCards(json.data ?? []);
        setTotal(json.total_cards ?? json.data?.length ?? 0);
        setHasMoreApi(Boolean(json.has_more));
        setApiPage(page);
      } catch {
        setIsError(true);
        setCards([]);
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const run = useCallback(
    async (q: string, ord = "", direction: "asc" | "desc" = "asc") => {
      setQuery(q.trim());
      setOrder(ord);
      setDir(direction);
      setApiPage(1);
      await fetchPage(q, 1, ord, direction);
    },
    [fetchPage]
  );

  const goApiPage = useCallback(
    async (page: number) => {
      if (page < 1 || isLoading) return;
      await fetchPage(query, page, order, dir);
    },
    [dir, fetchPage, isLoading, order, query]
  );

  return {
    cards,
    total,
    hasMoreApi,
    apiPage,
    isLoading,
    isError,
    query,
    run,
    goApiPage,
  };
}
