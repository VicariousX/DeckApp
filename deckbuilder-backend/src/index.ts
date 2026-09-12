import express from "express";
import type { Request, Response } from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

const PORT = 3001;
const HOST = "127.0.0.1";

const SCRYFALL_HEADERS = {
  "User-Agent": "DeckBuilderApp/1.0 (local development)",
  Accept: "application/json",
};

async function scryfallGet(pathAndQuery: string) {
  const url = pathAndQuery.startsWith("http")
    ? pathAndQuery
    : `https://api.scryfall.com${pathAndQuery}`;
  const response = await fetch(url, { headers: SCRYFALL_HEADERS });
  const data = await response.json();
  return { status: response.status, data };
}

// Full-text search (existing)
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
  // Express may type params as string | string[]; normalize to a single string
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
  const exact = req.query.exact as string | undefined;
  const fuzzy = req.query.fuzzy as string | undefined;
  if (!exact && !fuzzy) {
    return res
      .status(400)
      .json({ error: "Provide exact= or fuzzy= query parameter" });
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

// All printings for an oracle id (art picker)

app.post("/api/scryfall/collection", async (req: Request, res: Response) => {
  try {
    const identifiers = req.body?.identifiers;
    if (!Array.isArray(identifiers) || identifiers.length === 0) {
      res.status(400).json({
        error: "identifiers array required",
        details: "POST JSON body must be { identifiers: [{ name: string }, ...] }",
      });
      return;
    }
    // Scryfall limit: 75 per request
    const slice = identifiers.slice(0, 75);
    const upstream = await fetch("https://api.scryfall.com/cards/collection", {
      method: "POST",
      headers: {
        ...SCRYFALL_HEADERS,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ identifiers: slice }),
    });
    const data = await upstream.json();
    res.status(upstream.status).json(data);
  } catch (error) {
    console.error("Scryfall collection failed:", error);
    res.status(502).json({ error: "Scryfall collection request failed" });
  }
});

app.get("/api/scryfall/prints", async (req: Request, res: Response) => {
  const oracleId = req.query.oracle_id as string | undefined;
  if (!oracleId) {
    return res.status(400).json({ error: "Missing oracle_id" });
  }
  try {
    const q = `oracleid:${oracleId}`;
    const { status, data } = await scryfallGet(
      `/cards/search?q=${encodeURIComponent(q)}&unique=prints&order=released`
    );
    res.status(status).json(data);
  } catch (error) {
    console.error("Scryfall prints failed:", error);
    res.status(500).json({ error: "Scryfall request failed" });
  }
});

app.listen(PORT, HOST, () => {
  console.log(`Local-only backend running at http://${HOST}:${PORT}`);
});
