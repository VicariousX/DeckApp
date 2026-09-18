export type RandomHistoryEntry = {
  id: string;
  name: string;
  image: string | null;
  at: number;
};

const MAX = 50;

function key(userId: string | null | undefined): string {
  return `deckapp.randomHistory.${userId || "guest"}`;
}

export function readRandomHistory(
  userId: string | null | undefined
): RandomHistoryEntry[] {
  try {
    const raw = localStorage.getItem(key(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RandomHistoryEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function pushRandomHistory(
  userId: string | null | undefined,
  entry: Omit<RandomHistoryEntry, "at">
): RandomHistoryEntry[] {
  const next: RandomHistoryEntry[] = [
    { ...entry, at: Date.now() },
    ...readRandomHistory(userId).filter((e) => e.id !== entry.id),
  ].slice(0, MAX);
  try {
    localStorage.setItem(key(userId), JSON.stringify(next));
  } catch {
    /* ignore quota */
  }
  return next;
}

export function clearRandomHistory(userId: string | null | undefined): void {
  try {
    localStorage.removeItem(key(userId));
  } catch {
    /* ignore */
  }
}
