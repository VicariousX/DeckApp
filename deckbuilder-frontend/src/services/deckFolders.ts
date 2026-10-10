export type DeckFolder = {
  id: string;
  name: string;
};

function key(userId: string) {
  return `deckapp-folders:${userId}`;
}

function assignKey(userId: string) {
  return `deckapp-folder-assign:${userId}`;
}

export function loadFolders(userId: string): DeckFolder[] {
  try {
    const raw = JSON.parse(localStorage.getItem(key(userId)) || "[]") as DeckFolder[];
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

export function saveFolders(userId: string, folders: DeckFolder[]) {
  localStorage.setItem(key(userId), JSON.stringify(folders));
}

export function loadFolderAssignments(userId: string): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(assignKey(userId)) || "{}") as Record<string, string>;
  } catch {
    return {};
  }
}

export function setDeckFolder(userId: string, deckId: string, folderId: string | null) {
  const next = loadFolderAssignments(userId);
  if (!folderId) delete next[deckId];
  else next[deckId] = folderId;
  localStorage.setItem(assignKey(userId), JSON.stringify(next));
}

export function deleteFolder(userId: string, folderId: string) {
  saveFolders(userId, loadFolders(userId).filter((f) => f.id !== folderId));
  const next = loadFolderAssignments(userId);
  for (const [deckId, assigned] of Object.entries(next)) {
    if (assigned === folderId) delete next[deckId];
  }
  localStorage.setItem(assignKey(userId), JSON.stringify(next));
}
