# DeckApp alpha deploy (Cloudflare Pages + Render)

## Roles

- **Cloudflare Pages** — frontend (`deckbuilder-frontend`)
- **Render Web Service** — API (`deckbuilder-backend`)
- **Supabase** — auth, decks, drawers, card art (already used)
- **Scryfall** — live search via the API proxy; images from `cards.scryfall.io`

## Backend (Render)

1. New Web Service from this repo, root directory `deckbuilder-backend`.
2. Build: `npm install && npm run build`
3. Start: `npm start`
4. Env:

```
NODE_ENV=production
PORT=10000
HOST=0.0.0.0
CORS_ORIGINS=https://YOUR-PAGES-DOMAIN.pages.dev
BULK_ENABLED=false
```

Render sets `PORT`. Bind `0.0.0.0`. Health check: `/health`.

`BULK_ENABLED=false` keeps the process small. The API is a polite, rate-limited Scryfall router. Do not enable bulk on a 512MB instance — `default_cards` is ~100k objects and will OOM.

## Frontend (Cloudflare Pages)

1. Root directory `deckbuilder-frontend`.
2. Build: `npm run build`
3. Output: `dist`
4. Env (Pages → Settings → Environment variables):

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
```

Leave `VITE_API_URL` empty and edit `public/_redirects` so `/api/*` points at your Render URL. That keeps the browser same-origin and avoids CORS.

Or set `VITE_API_URL=https://your-service.onrender.com` and skip the proxy line in `_redirects` (keep the SPA `/* /index.html 200` rule).

## Bulk data strategy (alpha)

**Do not host the full Scryfall dump on Render or in Supabase for alpha.**

| Option | Why not / when |
| --- | --- |
| Server RAM bulk (current local default) | Fine on a laptop. Too big for a small Render box. |
| Supabase table of every card | 100k+ rows of fat JSON, egress cost, no Scryfall rate-limit benefit once loaded, painful to refresh. |
| Client IndexedDB from `data.scryfall.io` | Best next step: we hand the client the bulk catalog URI (already public, not rate-limited like `api.scryfall.com`). Each browser downloads oracle-cards / rulings once and we stay a router. |
| Cloudflare R2 snapshot | Good if we want one shared trimmed file later. Still not Postgres. |

Images stay on `cards.scryfall.io` / `scryfall.io`. We never store card art binaries except user uploads in the `card-art` bucket.

Alpha path: **live proxy + no server bulk**. Complex syntax search already goes to Scryfall search; that is the product path anyway.

## Local

```
# backend
cd deckbuilder-backend
cp .env.example .env   # optional
npm run dev            # bulk on unless NODE_ENV=production

# frontend
cd deckbuilder-frontend
npm run dev            # /api proxied to 127.0.0.1:3001
```
