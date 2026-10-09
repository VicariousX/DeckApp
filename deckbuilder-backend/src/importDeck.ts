/**
 * Fetch a public deck list from a shared link.
 * Returns names and boards. Card resolution stays on the client catalog.
 */

export type ImportBoard = "main" | "side" | "maybe" | "commander";

export type ImportedCard = {
  name: string;
  quantity: number;
  board: ImportBoard;
};

export type ImportedDeck = {
  name: string;
  format?: string;
  source: string;
  cards: ImportedCard[];
};

const UA =
  "Mozilla/5.0 (compatible; DeckApp/1.0; +https://deckapp-bwio.onrender.com)";

function boardFrom(label: string): ImportBoard {
  const s = label.toLowerCase();
  if (s.includes("commander") || s === "partner") return "commander";
  if (s.includes("side")) return "side";
  if (s.includes("maybe") || s.includes("consider")) return "maybe";
  return "main";
}

function pushCard(
  cards: ImportedCard[],
  name: string | undefined,
  quantity: number,
  board: ImportBoard
) {
  const clean = (name || "").replace(/\s+/g, " ").trim();
  if (!clean || quantity < 1) return;
  const existing = cards.find(
    (c) => c.board === board && c.name.toLowerCase() === clean.toLowerCase()
  );
  if (existing) existing.quantity += quantity;
  else cards.push({ name: clean, quantity, board });
}

async function getText(url: string, accept = "*/*"): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: accept },
    redirect: "follow",
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${new URL(url).host} returned ${res.status}`);
  }
  return text;
}

function parsePlainList(text: string): ImportedCard[] {
  const cards: ImportedCard[] = [];
  let board: ImportBoard = "main";
  for (const line of text.split(/\r?\n/)) {
    const raw = line.trim();
    if (!raw || raw.startsWith("#") || raw.startsWith("//")) continue;
    if (/^(sideboard|sb)\b/i.test(raw)) {
      board = "side";
      continue;
    }
    if (/^maybe(?:board)?\b/i.test(raw)) {
      board = "maybe";
      continue;
    }
    if (/^commander\b/i.test(raw)) {
      board = "commander";
      continue;
    }
    if (/^(mainboard|deck|main)\b/i.test(raw)) {
      board = "main";
      continue;
    }
    const match = raw.match(/^(\d+)\s*[xX]?\s+(.+)$/);
    if (!match) continue;
    pushCard(cards, match[2].replace(/\s*\([^)]+\)\s*$/, ""), Number(match[1]), board);
  }
  return cards;
}

async function fromArchidekt(id: string): Promise<ImportedDeck> {
  const data = JSON.parse(
    await getText(`https://archidekt.com/api/decks/${id}/`, "application/json")
  ) as {
    name?: string;
    deckFormat?: string | number;
    cards?: {
      quantity?: number;
      categories?: string[];
      card?: { oracleCard?: { name?: string } };
    }[];
  };
  const cards: ImportedCard[] = [];
  for (const row of data.cards || []) {
    const cats = row.categories || [];
    const board = cats.some((c) => /commander/i.test(c))
      ? "commander"
      : cats.some((c) => /side/i.test(c))
        ? "side"
        : cats.some((c) => /maybe/i.test(c))
          ? "maybe"
          : "main";
    pushCard(cards, row.card?.oracleCard?.name, row.quantity || 1, board);
  }
  return {
    name: data.name || "Archidekt deck",
    format: data.deckFormat != null ? String(data.deckFormat) : undefined,
    source: "archidekt",
    cards,
  };
}

async function fromMoxfield(id: string): Promise<ImportedDeck> {
  const text = await getText(
    `https://api2.moxfield.com/v2/decks/all/${encodeURIComponent(id)}`,
    "application/json"
  );
  if (text.trim().startsWith("<")) {
    throw new Error("Moxfield blocked the fetch. Export the deck as a list and paste it.");
  }
  const data = JSON.parse(text) as {
    name?: string;
    format?: string;
    boards?: Record<string, { cards?: Record<string, { quantity?: number; card?: { name?: string } }> }>;
  };
  const cards: ImportedCard[] = [];
  for (const [boardName, board] of Object.entries(data.boards || {})) {
    const dest = boardFrom(boardName);
    for (const row of Object.values(board.cards || {})) {
      pushCard(cards, row.card?.name, row.quantity || 1, dest);
    }
  }
  return {
    name: data.name || "Moxfield deck",
    format: data.format,
    source: "moxfield",
    cards,
  };
}

async function fromGoldfish(id: string): Promise<ImportedDeck> {
  const text = await getText(`https://www.mtggoldfish.com/deck/download/${id}`);
  return {
    name: "MTGGoldfish deck",
    source: "mtggoldfish",
    cards: parsePlainList(text),
  };
}

async function fromDeckstats(owner: string, id: string): Promise<ImportedDeck> {
  const text = await getText(
    `https://deckstats.net/api.php?action=get_deck&id_type=saved&owner_id=${encodeURIComponent(owner)}&id=${encodeURIComponent(id)}&response_type=list`
  );
  let name = "Deckstats deck";
  try {
    const data = JSON.parse(text) as { name?: string; list?: string };
    if (data.list) {
      return { name: data.name || name, source: "deckstats", cards: parsePlainList(data.list) };
    }
    if (data.name) name = data.name;
  } catch {
    /* plain list */
  }
  return { name, source: "deckstats", cards: parsePlainList(text) };
}

export async function importDeckFromUrl(rawUrl: string): Promise<ImportedDeck> {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    throw new Error("That is not a deck link.");
  }
  const host = url.hostname.replace(/^www\./, "");
  const parts = url.pathname.split("/").filter(Boolean);

  if (host === "archidekt.com") {
    const id = parts[parts.indexOf("decks") + 1];
    if (!id) throw new Error("Archidekt link is missing a deck id.");
    return fromArchidekt(id);
  }
  if (host === "moxfield.com") {
    const id = parts[parts.indexOf("decks") + 1];
    if (!id) throw new Error("Moxfield link is missing a deck id.");
    return fromMoxfield(id);
  }
  if (host === "mtggoldfish.com") {
    const id = parts[parts.indexOf("deck") + 1] || parts[parts.indexOf("download") + 1];
    if (!id || !/^\d+$/.test(id)) throw new Error("Goldfish link needs a numeric deck id.");
    return fromGoldfish(id);
  }
  if (host === "deckstats.net") {
    const owner = parts[parts.indexOf("decks") + 1];
    const deck = (parts[parts.indexOf("decks") + 2] || "").split("-")[0];
    if (!owner || !deck) throw new Error("Deckstats link is missing an owner or deck id.");
    return fromDeckstats(owner, deck);
  }
  throw new Error("Supported links: Archidekt, Moxfield, MTGGoldfish, Deckstats.");
}
