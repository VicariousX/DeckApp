export type DeckFolder = {
  id: string;
  name: string;
  parentId?: string | null;
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
  const all = loadFolders(userId);
  const remove = new Set<string>([folderId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const folder of all) {
      if (folder.parentId && remove.has(folder.parentId) && !remove.has(folder.id)) {
        remove.add(folder.id);
        grew = true;
      }
    }
  }
  saveFolders(userId, all.filter((f) => !remove.has(f.id)));
  const next = loadFolderAssignments(userId);
  for (const [deckId, assigned] of Object.entries(next)) {
    if (remove.has(assigned)) delete next[deckId];
  }
  localStorage.setItem(assignKey(userId), JSON.stringify(next));
}
