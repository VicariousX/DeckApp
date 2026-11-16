import { apiUrl } from "./apiBase";

/**
 * Call our /api/scryfall proxy, then Scryfall directly if the proxy answers
 * with a gateway error (Cloudflare/Render HTML 502) or is unreachable.
 * Body must be a string so a failed proxy attempt can be retried.
 */
export async function fetchProxiedScryfall(
  apiPath: string,
  init?: RequestInit
): Promise<Response> {
  const method = init?.method || "GET";
  const headers = init?.headers;
  const body = init?.body;

  try {
    const proxy = await fetch(apiUrl(apiPath), { method, headers, body });
    const type = proxy.headers.get("content-type") || "";
    if (proxy.status < 500 && type.includes("json")) return proxy;
  } catch {
    /* proxy unreachable — try Scryfall */
  }

  const direct = scryfallDirectUrl(apiPath);
  if (!direct) {
    return new Response(JSON.stringify({ error: "API unavailable" }), {
      status: 502,
      headers: { "content-type": "application/json" },
    });
  }
  return fetch(direct, { method, headers, body });
}

function scryfallDirectUrl(apiPath: string): string | null {
  const url = new URL(apiPath, "https://deckapp.local");
  const path = url.pathname;
  const search = url.search;
  if (path === "/api/scryfall") {
    return `https://api.scryfall.com/cards/search${search}`;
  }
  const card = path.match(/^\/api\/scryfall\/card\/([^/]+)$/);
  if (card) return `https://api.scryfall.com/cards/${card[1]}`;
  if (path === "/api/scryfall/collection") {
    return "https://api.scryfall.com/cards/collection";
  }
  const bulk = path.match(/^\/api\/scryfall\/bulk-data\/([^/]+)$/);
  if (bulk) return `https://api.scryfall.com/bulk-data/${bulk[1]}`;
  const rulings = path.match(/^\/api\/scryfall\/rulings\/([^/]+)$/);
  if (rulings) return `https://api.scryfall.com/cards/${rulings[1]}/rulings`;
  if (path === "/api/scryfall/prints") {
    const oracle = url.searchParams.get("oracle_id");
    if (!oracle) return null;
    return `https://api.scryfall.com/cards/search?q=${encodeURIComponent(`oracleid:${oracle}`)}&unique=prints`;
  }
  if (path === "/api/scryfall/autocomplete") {
    return `https://api.scryfall.com/cards/autocomplete${search}`;
  }
  if (path === "/api/scryfall/named") {
    return `https://api.scryfall.com/cards/named${search}`;
  }
  if (path === "/api/scryfall/random") {
    return "https://api.scryfall.com/cards/random";
  }
  return null;
}
