import express from "express";
import type { Request, Response } from "express";
import cors from "cors";
import { scryfallGet, scryfallPost } from "./scryfallClient";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

const PORT = 3001;
const HOST = "127.0.0.1";

// Full-text search
app.get("/api/scryfall", async (req: Request, res: Response) => {
  const query = req.query.q as string;
  if (!query) {
    return res.status(400).json({ error: "Missing query parameter 'q'" });
  }
  try {
    const { status, data } = await scryfallGet(
      `/cards/search?q=${encodeURIComponent(query)}`
    );
    res.status(status).json(data);
  } catch (error) {
    console.error("Scryfall search failed:", error);
    res.status(500).json({ error: "Scryfall request failed" });
  }
});

// Single card by Scryfall id (UUID)
app.get("/api/scryfall/card/:id", async (req: Request, res: Response) => {
  const raw = req.params.id;
  const id = Array.isArray(raw) ? raw[0] : raw;
  if (!id || typeof id !== "string") {
    return res.status(400).json({ error: "Missing card id" });
  }
  try {
    const { status, data } = await scryfallGet(
      `/cards/${encodeURIComponent(id)}`
    );
    res.status(status).json(data);
  } catch (error) {
    console.error("Scryfall card fetch failed:", error);
    res.status(500).json({ error: "Scryfall request failed" });
  }
});

// Autocomplete names
app.get("/api/scryfall/autocomplete", async (req: Request, res: Response) => {
  const q = (req.query.q as string | undefined)?.trim() ?? "";
  if (q.length < 2) {
    return res.json({ object: "catalog", data: [], total_values: 0 });
  }
  try {
    const { status, data } = await scryfallGet(
      `/cards/autocomplete?q=${encodeURIComponent(q)}`
    );
    res.status(status).json(data);
  } catch (error) {
    console.error("Scryfall autocomplete failed:", error);
    res.status(500).json({ error: "Scryfall request failed" });
  }
});

// Named lookup (exact or fuzzy)
app.get("/api/scryfall/named", async (req: Request, res: Response) => {
  const exact = (req.query.exact as string | undefined)?.trim();
  const fuzzy = (req.query.fuzzy as string | undefined)?.trim();
  if (!exact && !fuzzy) {
    return res.status(400).json({ error: "Provide exact or fuzzy name" });
  }
  try {
    const param = exact
      ? `exact=${encodeURIComponent(exact)}`
      : `fuzzy=${encodeURIComponent(fuzzy!)}`;
    const { status, data } = await scryfallGet(`/cards/named?${param}`);
    res.status(status).json(data);
  } catch (error) {
    console.error("Scryfall named failed:", error);
    res.status(500).json({ error: "Scryfall request failed" });
  }
});

// Collection (max 75 identifiers) — rate limited to 2/sec upstream
app.post("/api/scryfall/collection", async (req: Request, res: Response) => {
  const identifiers = req.body?.identifiers;
  if (!Array.isArray(identifiers) || identifiers.length === 0) {
    return res.status(400).json({ error: "identifiers array required" });
  }
  if (identifiers.length > 75) {
    return res.status(400).json({ error: "Max 75 identifiers per request" });
  }
  try {
    const { status, data } = await scryfallPost("/cards/collection", {
      identifiers,
    });
    res.status(status).json(data);
  } catch (error) {
    console.error("Scryfall collection failed:", error);
    res.status(500).json({ error: "Scryfall request failed" });
  }
});

// Printings for an oracle_id
app.get("/api/scryfall/prints", async (req: Request, res: Response) => {
  const oracleId = (req.query.oracle_id as string | undefined)?.trim();
  if (!oracleId) {
    return res.status(400).json({ error: "oracle_id required" });
  }
  try {
    const { status, data } = await scryfallGet(
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
  console.log("Scryfall upstream: queued + cached (respects 2/s and 10/s limits)");
});
