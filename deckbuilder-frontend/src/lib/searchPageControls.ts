import type { SearchTargetRef } from "../services/searchTargetService";

export type SearchBrowse = "text" | "catalog" | "scroll";

export type SearchPageControls = {
  browseMode: SearchBrowse;
  setBrowseMode: (mode: SearchBrowse) => void;
  sortKey: string;
  sortOptions: { key: string; label: string }[];
  setSort: (key: string) => void;
  sortDir: "asc" | "desc";
  toggleDir: () => void;
  pageSize: number;
  pageSizes: number[];
  setPageSize: (n: number) => void;
  columns: number;
  setColumns: (n: number) => void;
  targets: SearchTargetRef[];
  targetKey: string;
  setTarget: (key: string) => void;
  pinned: string[];
  togglePin: (key: string) => void;
  showTargetChip: boolean;
  setShowTargetChip: (on: boolean) => void;
};

let current: SearchPageControls | null = null;
const listeners = new Set<() => void>();

export function publishSearchPageControls(next: SearchPageControls | null) {
  current = next;
  listeners.forEach((listener) => listener());
}

export function subscribeSearchPageControls(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSearchPageControls() {
  return current;
}
