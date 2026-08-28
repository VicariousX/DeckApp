import { useQuery } from "@tanstack/react-query";

export function useScryfallSearch(searchTerm: string) {
  return useQuery({
    queryKey: ["scryfall", searchTerm],
    queryFn: async () => {
      const response = await fetch(
        `http://127.0.0.1:3001/api/scryfall?q=${encodeURIComponent(searchTerm)}`
      );
      return response.json();
    },
    enabled: searchTerm.length > 0, // only run when there's a term
    staleTime: 1000 * 60 * 5 // cache for 5 minutes
  });
}
