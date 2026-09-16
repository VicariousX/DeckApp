import express from "express";
import type { Request, Response } from "express";
import cors from "cors";
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

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

const PORT = 3001;
const HOST = "127.0.0.1";

// Kick off bulk load immediately (non-blocking for listen)
void ensureBulkData().catch((e) =>
  console.error("[bulk] initial load failed:", e)
);
void ensureRulingsData().catch((e) =>
  console.error("[bulk] rulings load failed:", e)
);

/** Live API only when bulk cannot answer — still rate-limited. */
async function liveGet(path: string) {
  return scryfallGet(path);
}

// --- Bulk status / admin ---
app.get("/api/scryfall/bulk/status", (_req: Request, res: Response) => {
  res.json(bulkStatus());
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
  if (!query) {
    return res.status(400).json({ error: "Missing query parameter 'q'" });
  }
  try {
    await ensureBulkData();
    const local = simpleNameSearch(query);
    if (local.length > 0) {
      return res.json({
        object: "list",
        total_cards: local.length,
        has_more: false,
        data: local,
        source: "bulk",
      });
    }
    // Complex Scryfall syntax → live API (rate-limited)
    const { status, data } = await liveGet(
      `/cards/search?q=${encodeURIComponent(query)}`
    );
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

app.listen(PORT, HOST, () => {
  console.log(`DeckApp API listening on http://${HOST}:${PORT}`);
  console.log(
    "Scryfall: bulk default_cards preferred; live API rate-limited fallback only"
  );
});
