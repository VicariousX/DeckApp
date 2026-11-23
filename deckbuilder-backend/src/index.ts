import express from "express";
import type { Request, Response } from "express";
import cors from "cors";
import http from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import { scryfallGet, scryfallPost } from "./scryfallClient.js";
import {
  autocompleteNames,
  bulkStatus,
  ensureBulkData,
  getCardById,
  getCardByName,
  getPrintsByOracleId,
  getRandomCard,
  getRulingsByOracleId,
  ensureRulingsData,
  simpleNameSearch,
} from "./bulkData.js";
import { BULK_ENABLED, CORS_ORIGINS, HOST, PORT } from "./config.js";
import { appendAction, getRoom, putRoom } from "./tableRooms.js";
import { importDeckFromUrl } from "./importDeck.js";
import { mountMechanicBot } from "./mechanicBot.js";
import type { TableState, TableWire } from "./wire.js";

const app = express();
app.use(
  cors({
    origin: CORS_ORIGINS.length > 0 ? CORS_ORIGINS : true,
    credentials: false,
  })
);
app.use(express.json({ limit: "1mb" }));

if (BULK_ENABLED) {
  void ensureBulkData().catch((e) =>
    console.error("[bulk] initial load failed:", e)
  );
  void ensureRulingsData().catch((e) =>
    console.error("[bulk] rulings load failed:", e)
  );
} else {
  console.log("[bulk] disabled — live Scryfall via rate-limited proxy only");
}

function health(_req: Request, res: Response) {
  res.json({
    ok: true,
    service: "deckapp-api",
    bulk: bulkStatus(),
  });
}

app.get("/health", health);
app.get("/api/health", health);

app.get("/api/import/deck", async (req: Request, res: Response) => {
  const url = String(req.query.url || "");
  if (!url) return res.status(400).json({ error: "Missing url" });
  try {
    const deck = await importDeckFromUrl(url);
    if (deck.cards.length === 0) {
      return res.status(422).json({ error: "No cards found at that link." });
    }
    res.json(deck);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Import failed";
    res.status(502).json({ error: message });
  }
});

const DECK_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function supabaseHeaders() {
  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!base || !key) return null;
  return {
    base,
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  };
}

function artFace(
  base: string,
  card: { scryfall_id: string; oracle_id?: string },
  art?: { preferred_scryfall_id?: string | null; custom_front_path?: string | null },
  face: "front" | "back" = "front"
) {
  if (face === "front" && art?.custom_front_path) {
    return `${base.replace(/\/$/, "")}/storage/v1/object/public/card-art/${art.custom_front_path.replace(/^\//, "")}`;
  }
  const printing = (art?.preferred_scryfall_id || card.scryfall_id).toLowerCase();
  const api = process.env.PUBLIC_API_URL || "https://deckapp-1.onrender.com";
  const query = face === "back" ? "?face=back" : "";
  return `${api.replace(/\/$/, "")}/api/tts/image/${printing}.jpg${query}`;
}

const DFC_LAYOUTS = new Set([
  "transform",
  "modal_dfc",
  "double_faced_token",
  "reversible_card",
  "art_series",
  "double_sided",
]);

function tokenPiles(
  byId: Map<string, { id?: string; all_parts?: { id?: string; component?: string; name?: string; type_line?: string }[] }>
) {
  const api = process.env.PUBLIC_API_URL || "https://deckapp-1.onrender.com";
  const base = api.replace(/\/$/, "");
  const tokens = new Map<string, { name: string; face: string; quantity: number }>();
  for (const card of byId.values()) {
    for (const part of card.all_parts || []) {
      if (!part.id || part.id === card.id) continue;
      const type = (part.type_line || "").toLowerCase();
      const component = part.component || "";
      const isToken =
        component === "token" ||
        type.includes("token") ||
        type.includes("emblem") ||
        type.includes("dungeon");
      if (!isToken) continue;
      const key = part.name || part.id;
      const existing = tokens.get(key);
      if (existing) continue;
      tokens.set(key, {
        name: part.name || "Token",
        quantity: 1,
        face: `${base}/api/tts/image/${part.id.toLowerCase()}.jpg`,
      });
    }
  }
  return [...tokens.values()];
}

type FaceText = {
  mana_cost?: string;
  type_line?: string;
  oracle_text?: string;
  power?: string;
  toughness?: string;
  loyalty?: string;
};

function hoverTip(card: FaceText | undefined): string {
  if (!card) return "";
  const lines: string[] = [];
  if (card.mana_cost) lines.push(card.mana_cost);
  if (card.type_line) lines.push(card.type_line);
  if (card.oracle_text) lines.push(card.oracle_text);
  if (card.power != null && card.toughness != null && card.power !== "" && card.toughness !== "") {
    lines.push(`${card.power}/${card.toughness}`);
  } else if (card.loyalty) lines.push(`Loyalty ${card.loyalty}`);
  return lines.join("\n").slice(0, 1400);
}

function publicArtUrl(base: string, path: string) {
  const clean = path.replace(/^\//, "").split("/").map(encodeURIComponent).join("/");
  return `${base.replace(/\/$/, "")}/storage/v1/object/public/card-art/${clean}`;
}

function deckIdFromUrl(raw: string): string | null {
  const match = raw.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  if (!match) return null;
  if (!/\/deck\/|\/api\/tts\/deck\//i.test(raw) && !/deckapp/i.test(raw)) return null;
  return match[0];
}

app.get("/api/tts/image/:file", async (req: Request, res: Response) => {
  const raw = req.params.file;
  const file = Array.isArray(raw) ? raw[0] : raw;
  const id = String(file || "").replace(/\.jpg$/i, "").toLowerCase();
  if (!DECK_ID.test(id)) return res.status(400).end();
  const back = String(req.query.face || "") === "back";
  const sources = back
    ? [
        `https://api.scryfall.com/cards/${id}?format=image&version=normal&face=back`,
        `https://cards.scryfall.io/normal/back/${id[0]}/${id[1]}/${id}.jpg`,
      ]
    : [
        `https://api.scryfall.com/cards/${id}?format=image&version=normal`,
        `https://cards.scryfall.io/normal/front/${id[0]}/${id[1]}/${id}.jpg`,
      ];
  for (const source of sources) {
    try {
      const image = await fetch(source, {
        headers: { Accept: "image/jpeg", "User-Agent": "DeckApp/1.0" },
        redirect: "follow",
      });
      if (!image.ok) continue;
      const bytes = Buffer.from(await image.arrayBuffer());
      if (bytes.length < 1000) continue;
      res.setHeader("Content-Type", "image/jpeg");
      res.setHeader("Content-Disposition", "inline; filename=card.jpg");
      res.setHeader("Cache-Control", "public, max-age=86400");
      return res.send(bytes);
    } catch (e) {
      console.error(e);
    }
  }
  res.status(502).json({ error: "Card image could not be fetched" });
});

const TTS_NONE = { id: "none", name: "None" };

async function listSleeves(_req: Request, res: Response) {
  const ctx = supabaseHeaders();
  const sleeves: { id: string; name: string; url: string }[] = [];
  if (ctx) {
    try {
      const listRes = await fetch(
        `${ctx.base}/rest/v1/card_sleeves?is_public=eq.true&select=id,name,storage_path&order=created_at.desc&limit=200`,
        { headers: ctx.headers }
      );
      const rows = (await listRes.json()) as { id?: string; name?: string; storage_path?: string }[];
      if (listRes.ok && Array.isArray(rows)) {
        for (const row of rows) {
          if (!row.id || !row.storage_path) continue;
          sleeves.push({
            id: row.id,
            name: row.name || "Sleeve",
            url: publicArtUrl(ctx.base, row.storage_path),
          });
        }
      }
    } catch (e) {
      console.error(e);
    }
  }
  res.json({ sleeves, none: TTS_NONE });
}

app.get("/api/tts/sleeves", listSleeves);
app.get("/api/tts/skins", listSleeves);

async function sendUserSleeve(id: string, res: Response) {
  const ctx = supabaseHeaders();
  if (!ctx) return false;
  const listRes = await fetch(
    `${ctx.base}/rest/v1/card_sleeves?id=eq.${id}&is_public=eq.true&select=storage_path`,
    { headers: ctx.headers }
  );
  const rows = (await listRes.json()) as { storage_path?: string }[];
  const path = rows?.[0]?.storage_path;
  if (!listRes.ok || !path) return false;
  const source = publicArtUrl(ctx.base, path);
  const image = await fetch(source, { headers: { "User-Agent": "DeckApp/1.0" } });
  if (!image.ok) return false;
  const bytes = Buffer.from(await image.arrayBuffer());
  if (bytes.length < 200) return false;
  const type = bytes[0] === 0x89 ? "image/png" : "image/jpeg";
  res.setHeader("Content-Type", type);
  res.setHeader("Cache-Control", "public, max-age=86400");
  res.send(bytes);
  return true;
}

async function sendSleeveFile(req: Request, res: Response) {
  const raw = req.params.file;
  const file = Array.isArray(raw) ? raw[0] : raw;
  const id = String(file || "").replace(/\.jpe?g$/i, "").replace(/\.png$/i, "").toLowerCase();
  if (id === "none" || id === "classic") {
    return res.redirect(302, "https://backs.scryfall.io/large/0/a/0aeebaf5-8c7d-4636-9e82-8c27447861f7.jpg");
  }
  if (DECK_ID.test(id)) {
    try {
      if (await sendUserSleeve(id, res)) return;
    } catch (e) {
      console.error(e);
    }
  }
  return res.status(404).end();
}

app.get("/api/tts/sleeve/:file", sendSleeveFile);
app.get("/api/tts/skin/:file", sendSleeveFile);

app.get("/api/tts/back.jpg", async (_req: Request, res: Response) => {
  const CARD_BACK = "https://backs.scryfall.io/large/0/a/0aeebaf5-8c7d-4636-9e82-8c27447861f7.jpg";
  try {
    const image = await fetch(CARD_BACK, { headers: { Accept: "image/jpeg", "User-Agent": "DeckApp/1.0" } });
    if (!image.ok) return res.status(502).json({ error: "Card back could not be fetched" });
    const bytes = Buffer.from(await image.arrayBuffer());
    res.setHeader("Content-Type", "image/jpeg");
    res.setHeader("Content-Disposition", "inline; filename=back.jpg");
    res.send(bytes);
  } catch (e) {
    console.error(e);
    res.status(502).json({ error: "Card back could not be fetched" });
  }
});

app.get("/api/tts/decks", async (req: Request, res: Response) => {
  const ctx = supabaseHeaders();
  if (!ctx) return res.status(503).json({ error: "Deck lookup is not configured" });
  const q = String(req.query.q ?? "").replace(/[%*,()]/g, " ").trim();
  const limit = Math.min(80, Math.max(1, parseInt(String(req.query.limit ?? "40"), 10) || 40));
  const offset = Math.max(0, parseInt(String(req.query.offset ?? "0"), 10) || 0);
  try {
    const filter = q ? `&name=ilike.*${encodeURIComponent(q)}*` : "";
    const url = `${ctx.base}/rest/v1/decks?is_public=eq.true&select=id,name,format,updated_at&order=updated_at.desc&limit=${limit}&offset=${offset}${filter}`;
    const listRes = await fetch(url, { headers: { ...ctx.headers, Prefer: "count=exact" } });
    const rows = (await listRes.json()) as { name?: string }[];
    if (!listRes.ok || !Array.isArray(rows)) {
      const message = rows && typeof rows === "object" && "message" in rows ? String((rows as { message: unknown }).message) : "Deck list failed";
      return res.status(502).json({ error: message, decks: [], total: 0 });
    }
    const range = listRes.headers.get("content-range") || "";
    const total = Number(range.split("/")[1]) || rows.length;
    res.json({ decks: rows, total, offset, limit });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Deck list failed" });
  }
});

app.get("/api/tts/deck/:id", async (req: Request, res: Response) => {
  const raw = req.params.id;
  const id = Array.isArray(raw) ? raw[0] : raw;
  if (!id || !DECK_ID.test(id)) return res.status(400).json({ error: "Deck id required" });
  const ctx = supabaseHeaders();
  if (!ctx) return res.status(503).json({ error: "Deck lookup is not configured" });
  try {
    const deckRes = await fetch(
      `${ctx.base}/rest/v1/decks?id=eq.${id}&select=id,name,format,is_public,user_id`,
      { headers: ctx.headers }
    );
    const decks = (await deckRes.json()) as { id: string; name: string; format: string; is_public: boolean; user_id: string }[];
    const deck = decks[0];
    if (!deck) return res.status(404).json({ error: "Deck not found" });
    if (!deck.is_public && String(req.query.link || "") !== "1") return res.status(404).json({ error: "Deck is not public" });
    const cardsRes = await fetch(
      `${ctx.base}/rest/v1/deck_cards?deck_id=eq.${id}&select=name,scryfall_id,oracle_id,quantity,board`,
      { headers: ctx.headers }
    );
    const rows = (await cardsRes.json()) as {
      name: string;
      scryfall_id: string;
      oracle_id: string;
      quantity: number;
      board: string;
    }[];
    const artRes = await fetch(
      `${ctx.base}/rest/v1/user_card_art?user_id=eq.${deck.user_id}&select=oracle_id,preferred_scryfall_id,custom_front_path`,
      { headers: ctx.headers }
    );
    const artRows = (await artRes.json()) as {
      oracle_id: string;
      preferred_scryfall_id: string | null;
      custom_front_path: string | null;
    }[];
    const artByOracle = new Map(
      (Array.isArray(artRows) ? artRows : []).map((a) => [String(a.oracle_id).toLowerCase(), a])
    );
    const identifiers = rows.map((c) => {
      const art = artByOracle.get(String(c.oracle_id).toLowerCase());
      return { id: (art?.preferred_scryfall_id || c.scryfall_id).toLowerCase() };
    });
    const byId = new Map<string, {
      id?: string;
      name?: string;
      layout?: string;
      mana_cost?: string;
      type_line?: string;
      oracle_text?: string;
      power?: string;
      toughness?: string;
      loyalty?: string;
      card_faces?: (FaceText & { name?: string; image_uris?: unknown })[];
      all_parts?: { id?: string; component?: string; name?: string; type_line?: string }[];
    }>();
    for (let i = 0; i < identifiers.length; i += 75) {
      const chunk = identifiers.slice(i, i + 75);
      try {
        const { data } = await scryfallPost("/cards/collection", { identifiers: chunk });
        const found = (data as { data?: {
          id: string;
          layout?: string;
          card_faces?: (FaceText & { name?: string; image_uris?: unknown })[];
          all_parts?: { id?: string; component?: string; name?: string; type_line?: string }[];
        }[] })?.data;
        for (const card of found || []) byId.set(card.id.toLowerCase(), card);
      } catch (e) {
        console.error(e);
      }
    }
    res.json({
      id: deck.id,
      name: deck.name,
      format: deck.format,
      cards: (Array.isArray(rows) ? rows : []).map((c) => {
        const art = artByOracle.get(String(c.oracle_id).toLowerCase());
        const printing = (art?.preferred_scryfall_id || c.scryfall_id).toLowerCase();
        const printed = byId.get(printing);
        const otherFace = printed?.card_faces?.[1];
        const frontFace = printed?.card_faces?.[0];
        const frontText = frontFace?.oracle_text || frontFace?.type_line ? frontFace : printed;
        const faces =
          printed && DFC_LAYOUTS.has(String(printed.layout)) && otherFace?.image_uris
            ? [
                { name: frontFace?.name || c.name, face: artFace(ctx.base, c, art, "front"), tip: hoverTip(frontText) },
                { name: otherFace.name || `${c.name} back`, face: artFace(ctx.base, c, art, "back"), tip: hoverTip(otherFace) },
              ]
            : undefined;
        return {
          name: c.name,
          scryfallId: c.scryfall_id,
          quantity: c.quantity,
          board: c.board,
          layout: printed?.layout,
          face: artFace(ctx.base, c, art, "front"),
          tip: hoverTip(frontText),
          faces,
        };
      }),
      tokens: tokenPiles(byId),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Deck lookup failed" });
  }
});

app.get("/api/tts/import", async (req: Request, res: Response) => {
  const raw = String(req.query.url || "").trim();
  if (!raw) return res.status(400).json({ error: "Missing url" });
  const deckId = deckIdFromUrl(raw);
  if (deckId) {
    try {
      const local = await fetch(`http://127.0.0.1:${PORT}/api/tts/deck/${deckId}?link=1`);
      const body = await local.json();
      return res.status(local.status).json(body);
    } catch (e) {
      console.error(e);
      return res.status(502).json({ error: "DeckApp link failed" });
    }
  }
  try {
    const imported = await importDeckFromUrl(raw);
    const names = [...new Set(imported.cards.map((c) => c.name))];
    type PrintedCard = FaceText & {
      id?: string;
      name?: string;
      layout?: string;
      card_faces?: (FaceText & { name?: string; image_uris?: unknown })[];
      all_parts?: { id?: string; component?: string; name?: string; type_line?: string }[];
    };
    const byName = new Map<string, PrintedCard>();
    for (let i = 0; i < names.length; i += 75) {
      const identifiers = names.slice(i, i + 75).map((name) => ({ name }));
      const { data } = await scryfallPost("/cards/collection", { identifiers });
      const found = (data as { data?: PrintedCard[] })?.data || [];
      for (const card of found) {
        if (card.name) byName.set(card.name.toLowerCase(), card);
      }
    }
    const api = process.env.PUBLIC_API_URL || "https://deckapp-1.onrender.com";
    const base = api.replace(/\/$/, "");
    const missing: string[] = [];
    const cards = [];
    for (const row of imported.cards) {
      const printed = byName.get(row.name.toLowerCase());
      if (!printed?.id) {
        missing.push(row.name);
        continue;
      }
      const front = printed.card_faces?.[0];
      const other = printed.card_faces?.[1];
      const frontText = front?.oracle_text || front?.type_line ? front : printed;
      const face = `${base}/api/tts/image/${printed.id.toLowerCase()}.jpg`;
      cards.push({
        name: row.name,
        quantity: row.quantity,
        board: row.board,
        face,
        tip: hoverTip(frontText),
        faces:
          printed.layout && DFC_LAYOUTS.has(printed.layout) && other?.image_uris
            ? [
                { name: front?.name || row.name, face, tip: hoverTip(frontText) },
                {
                  name: other.name || `${row.name} back`,
                  face: `${face}?face=back`,
                  tip: hoverTip(other),
                },
              ]
            : undefined,
      });
    }
    res.json({
      name: imported.name,
      format: imported.format,
      source: imported.source,
      cards,
      tokens: tokenPiles(byName),
      missing,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Import failed";
    res.status(502).json({ error: message });
  }
});

app.get("/api/tables/:id", (req: Request, res: Response) => {
  const room = getRoom(String(req.params.id));
  if (!room) return res.status(404).json({ error: "No table" });
  res.json({ id: room.id, hostSeat: room.hostSeat, state: room.state, actions: room.actions.slice(-50) });
});

app.put("/api/tables/:id", (req: Request, res: Response) => {
  const state = req.body?.state as TableState | undefined;
  if (!state?.id) return res.status(400).json({ error: "state required" });
  const room = putRoom(String(req.params.id), state, String(req.body?.hostSeat ?? state.seats?.[0]?.id ?? "host"));
  res.json({ id: room.id, hostSeat: room.hostSeat });
});

/** Live API only when bulk cannot answer — still rate-limited. */
async function liveGet(path: string) {
  return scryfallGet(path);
}

// --- Bulk status / admin ---
app.get("/api/scryfall/bulk/status", (_req: Request, res: Response) => {
  res.json(bulkStatus());
});

const BULK_TYPES = new Set([
  "oracle-cards",
  "default-cards",
  "unique-artwork",
  "rulings",
]);

/** Metadata only — client downloads the file from data.scryfall.io. */
app.get("/api/scryfall/bulk-data/:type", async (req: Request, res: Response) => {
  const raw = req.params.type;
  const type = Array.isArray(raw) ? raw[0] : raw;
  if (!type || !BULK_TYPES.has(type)) {
    return res.status(400).json({ error: "Unknown bulk type" });
  }
  try {
    const { status, data } = await liveGet(`/bulk-data/${encodeURIComponent(type)}`);
    res.status(status).json(data);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Bulk metadata failed" });
  }
});

app.post("/api/scryfall/bulk/refresh", async (_req: Request, res: Response) => {
  try {
    await ensureBulkData({ force: true });
    res.json({ ok: true, ...bulkStatus() });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Bulk refresh failed" });
  }
});

// Full-text / name search — prefer local name index for simple queries
app.get("/api/scryfall", async (req: Request, res: Response) => {
  const query = req.query.q as string;
  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
  if (!query) {
    return res.status(400).json({ error: "Missing query parameter 'q'" });
  }
  try {
    await ensureBulkData();
    const local = simpleNameSearch(query);
    if (local.length > 0 && page === 1) {
      return res.json({
        object: "list",
        total_cards: local.length,
        has_more: false,
        data: local,
        source: "bulk",
      });
    }
    if (local.length > 0 && page > 1) {
      return res.json({
        object: "list",
        total_cards: local.length,
        has_more: false,
        data: [],
        source: "bulk",
      });
    }
    const order = typeof req.query.order === "string" ? req.query.order : "";
    const dir = req.query.dir === "desc" ? "desc" : "asc";
    let path = `/cards/search?q=${encodeURIComponent(query)}&page=${page}`;
    if (order) path += `&order=${encodeURIComponent(order)}&dir=${dir}`;
    const { status, data } = await liveGet(path);
    res.status(status).json(data);
  } catch (error) {
    console.error("Scryfall search failed:", error);
    res.status(500).json({ error: "Scryfall request failed" });
  }
});

// Random unique card from local bulk (fallback: live /cards/random)
app.get("/api/scryfall/random", async (_req: Request, res: Response) => {
  try {
    await ensureBulkData();
    const local = getRandomCard();
    if (local) return res.json(local);
    const { status, data } = await liveGet("/cards/random");
    res.status(status).json(data);
  } catch (error) {
    console.error("Scryfall random failed:", error);
    res.status(500).json({ error: "Scryfall request failed" });
  }
});

// Official rulings from local bulk (keyed by oracle_id)
app.get("/api/scryfall/rulings/:id", async (req: Request, res: Response) => {
  const raw = req.params.id;
  const id = Array.isArray(raw) ? raw[0] : raw;
  if (!id || typeof id !== "string") {
    return res.status(400).json({ error: "Missing card id" });
  }
  try {
    await Promise.all([ensureBulkData(), ensureRulingsData()]);
    const oracle =
      (typeof req.query.oracle === "string" && req.query.oracle) ||
      getCardById(id)?.oracle_id ||
      id;
    const list = getRulingsByOracleId(String(oracle));
    return res.json({
      object: "list",
      data: list,
      has_more: false,
      source: "bulk",
    });
  } catch (error) {
    console.error("Rulings lookup failed:", error);
    res.status(500).json({ error: "Rulings lookup failed" });
  }
});

// Single card by Scryfall id
app.get("/api/scryfall/card/:id", async (req: Request, res: Response) => {
  const raw = req.params.id;
  const id = Array.isArray(raw) ? raw[0] : raw;
  if (!id || typeof id !== "string") {
    return res.status(400).json({ error: "Missing card id" });
  }
  try {
    await ensureBulkData();
    const local = getCardById(id);
    if (local) {
      return res.json(local);
    }
    const { status, data } = await liveGet(
      `/cards/${encodeURIComponent(id)}`
    );
    res.status(status).json(data);
  } catch (error) {
    console.error("Scryfall card fetch failed:", error);
    res.status(500).json({ error: "Scryfall request failed" });
  }
});

// Autocomplete — fully local when bulk is ready
app.get("/api/scryfall/autocomplete", async (req: Request, res: Response) => {
  const q = (req.query.q as string | undefined)?.trim() ?? "";
  if (q.length < 2) {
    return res.json({ object: "catalog", data: [], total_values: 0 });
  }
  try {
    await ensureBulkData();
    const status = bulkStatus();
    if (status.ready) {
      const names = autocompleteNames(q);
      return res.json({
        object: "catalog",
        data: names,
        total_values: names.length,
        source: "bulk",
      });
    }
    const { status: st, data } = await liveGet(
      `/cards/autocomplete?q=${encodeURIComponent(q)}`
    );
    res.status(st).json(data);
  } catch (error) {
    console.error("Scryfall autocomplete failed:", error);
    res.status(500).json({ error: "Scryfall request failed" });
  }
});

// Named lookup
app.get("/api/scryfall/named", async (req: Request, res: Response) => {
  const exact = (req.query.exact as string | undefined)?.trim();
  const fuzzy = (req.query.fuzzy as string | undefined)?.trim();
  if (!exact && !fuzzy) {
    return res.status(400).json({ error: "Provide exact or fuzzy name" });
  }
  try {
    await ensureBulkData();
    const name = exact || fuzzy!;
    const local = getCardByName(name);
    if (local && exact) {
      return res.json(local);
    }
    if (local && fuzzy) {
      return res.json(local);
    }
    const param = exact
      ? `exact=${encodeURIComponent(exact)}`
      : `fuzzy=${encodeURIComponent(fuzzy!)}`;
    const { status, data } = await liveGet(`/cards/named?${param}`);
    res.status(status).json(data);
  } catch (error) {
    console.error("Scryfall named failed:", error);
    res.status(500).json({ error: "Scryfall request failed" });
  }
});

// Collection — try resolve each id/name from bulk first; only miss → live
app.post("/api/scryfall/collection", async (req: Request, res: Response) => {
  const identifiers = req.body?.identifiers;
  if (!Array.isArray(identifiers) || identifiers.length === 0) {
    return res.status(400).json({ error: "identifiers array required" });
  }
  if (identifiers.length > 75) {
    return res.status(400).json({ error: "Max 75 identifiers per request" });
  }
  try {
    await ensureBulkData();
    const data: unknown[] = [];
    const not_found: unknown[] = [];
    const needLive: unknown[] = [];

    for (const ident of identifiers) {
      if (ident && typeof ident === "object") {
        const id = (ident as { id?: string }).id;
        const name = (ident as { name?: string }).name;
        if (id) {
          const c = getCardById(id);
          if (c) {
            data.push(c);
            continue;
          }
        }
        if (name) {
          const c = getCardByName(name);
          if (c) {
            data.push(c);
            continue;
          }
        }
        needLive.push(ident);
      } else {
        not_found.push(ident);
      }
    }

    if (needLive.length === 0) {
      return res.json({ object: "list", data, not_found, source: "bulk" });
    }

    // Only unresolved identifiers hit live collection API
    const { status, data: live } = await scryfallPost("/cards/collection", {
      identifiers: needLive,
    });
    if (status >= 400) {
      return res.status(status).json(live);
    }
    const liveObj = live as {
      data?: unknown[];
      not_found?: unknown[];
    };
    data.push(...(liveObj.data ?? []));
    not_found.push(...(liveObj.not_found ?? []));
    res.json({ object: "list", data, not_found, source: "bulk+live" });
  } catch (error) {
    console.error("Scryfall collection failed:", error);
    res.status(500).json({ error: "Scryfall request failed" });
  }
});

// Printings for an oracle_id — fully from bulk
app.get("/api/scryfall/prints", async (req: Request, res: Response) => {
  const oracleId = (req.query.oracle_id as string | undefined)?.trim();
  if (!oracleId) {
    return res.status(400).json({ error: "oracle_id required" });
  }
  try {
    await ensureBulkData();
    const prints = getPrintsByOracleId(oracleId);
    if (prints.length > 0) {
      return res.json({
        object: "list",
        total_cards: prints.length,
        has_more: false,
        data: prints,
        source: "bulk",
      });
    }
    const { status, data } = await liveGet(
      `/cards/search?q=${encodeURIComponent(
        `oracleid:${oracleId}`
      )}&unique=prints&order=released`
    );
    res.status(status).json(data);
  } catch (error) {
    console.error("Scryfall prints failed:", error);
    res.status(500).json({ error: "Scryfall request failed" });
  }
});

mountMechanicBot(app);

const server = http.createServer(app);
const sockets = new WebSocketServer({ server, path: "/api/tables/socket" });
const peers = new Map<string, Set<WebSocket>>();

function roomOf(ws: WebSocket): string {
  return (ws as WebSocket & { roomId?: string }).roomId ?? "";
}

function relay(roomId: string, msg: TableWire, except?: WebSocket) {
  for (const peer of peers.get(roomId) ?? []) {
    if (peer !== except && peer.readyState === 1) peer.send(JSON.stringify(msg));
  }
}

sockets.on("connection", (ws, req) => {
  const url = new URL(req.url ?? "", "http://localhost");
  const roomId = url.searchParams.get("room") ?? "";
  const role = url.searchParams.get("role") ?? "guest";
  const name = url.searchParams.get("name") ?? "Guest";
  if (!roomId) {
    ws.close();
    return;
  }
  (ws as WebSocket & { roomId?: string; role?: string }).roomId = roomId;
  (ws as WebSocket & { role?: string }).role = role;
  const set = peers.get(roomId) ?? new Set<WebSocket>();
  set.add(ws);
  peers.set(roomId, set);
  const room = getRoom(roomId);
  if (room) {
    const welcome: TableWire = {
      kind: "welcome",
      seatId: role === "host" ? room.hostSeat : `guest-${name}`,
      state: room.state,
      from: room.hostSeat,
    };
    ws.send(JSON.stringify(welcome));
  }
  if (role === "guest") {
    relay(roomId, { kind: "join", from: name, name }, ws);
  }
  ws.on("message", (raw) => {
    let msg: TableWire;
    try {
      msg = JSON.parse(String(raw)) as TableWire;
    } catch {
      return;
    }
    if (msg.kind === "snapshot") {
      putRoom(roomId, msg.state, msg.from);
    }
    if (msg.kind === "action" && msg.state) {
      appendAction(roomId, msg.action, msg.state);
    }
    relay(roomId, msg, ws);
  });
  ws.on("close", () => {
    peers.get(roomOf(ws))?.delete(ws);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`DeckApp API listening on http://${HOST}:${PORT}`);
  console.log(
    BULK_ENABLED
      ? "Scryfall: bulk preferred; live API rate-limited fallback"
      : "Scryfall: live API only (BULK_ENABLED=false)"
  );
});
