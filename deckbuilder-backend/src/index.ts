import express from "express";
import type { Request, Response } from "express";
import cors from "cors";



const app = express();

app.use(cors()); // ⭐ allow requests from your frontend

// ⭐ Local-only binding — SAFE on public Wi-Fi
const PORT = 3001;
const HOST = "127.0.0.1";

// ⭐ Scryfall proxy route
app.get("/api/scryfall", async (req: Request, res: Response) => {
  
    console.log("Received request:", req.query);

    const query = req.query.q as string;

  if (!query) {
    return res.status(400).json({ error: "Missing query parameter 'q'" });
  }

  try {
    const response = await fetch(
        `https://api.scryfall.com/cards/search?q=${encodeURIComponent(query)}`,
        {
            headers: {
            "User-Agent": "DeckBuilderApp/1.0 (local development)"
            }
        }
    );

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("Scryfall fetch failed:", error);
    res.status(500).json({ error: "Scryfall request failed" });
  }
});

app.listen(PORT, HOST, () => {
  console.log(`Local-only backend running at http://${HOST}:${PORT}`);
});
