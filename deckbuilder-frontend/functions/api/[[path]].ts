const BACKEND = "https://deckapp-bwio.onrender.com";

function corsHeaders(origin: string): Headers {
  const h = new Headers();
  h.set("Access-Control-Allow-Origin", origin || "*");
  h.set("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  h.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  h.set("Access-Control-Max-Age", "86400");
  return h;
}

export const onRequest: PagesFunction = async (context) => {
  const incoming = new URL(context.request.url);
  // R2 proxy-art functions own these paths. If this catch-all runs, the
  // specific function was not deployed — fail clearly instead of proxying.
  if (incoming.pathname === "/api/proxy-art" || incoming.pathname.startsWith("/api/proxy-art/")) {
    return new Response(JSON.stringify({
      error: "proxy-art function is not deployed. Redeploy Cloudflare Pages after binding PROXY_ART.",
    }), { status: 503, headers: { "Content-Type": "application/json" } });
  }
  if (context.request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(incoming.origin) });
  }

  const target = `${BACKEND}${incoming.pathname}${incoming.search}`;
  const headers = new Headers(context.request.headers);
  headers.delete("host");

  const init: RequestInit = {
    method: context.request.method,
    headers,
    redirect: "follow",
  };
  if (context.request.method !== "GET" && context.request.method !== "HEAD") {
    init.body = context.request.body;
  }

  const res = await fetch(target, init);
  const out = new Headers(res.headers);
  out.set("Access-Control-Allow-Origin", incoming.origin || "*");
  return new Response(res.body, { status: res.status, headers: out });
};
