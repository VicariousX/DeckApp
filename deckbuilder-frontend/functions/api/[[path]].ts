const BACKEND = "https://deckapp-1.onrender.com";

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
  // Do not forward the browser's Host or CF-* headers. Render sits behind
  // Cloudflare too, and those headers make the subrequest return an HTML 502.
  const headers = new Headers();
  const accept = context.request.headers.get("accept");
  headers.set("Accept", accept && !accept.includes("text/html") ? accept : "application/json");
  headers.set("User-Agent", "DeckApp/1.0");
  const contentType = context.request.headers.get("content-type");
  if (contentType) headers.set("Content-Type", contentType);
  const authorization = context.request.headers.get("authorization");
  if (authorization) headers.set("Authorization", authorization);

  const init: RequestInit & { duplex?: "half" } = {
    method: context.request.method,
    headers,
    redirect: "follow",
  };
  if (context.request.method !== "GET" && context.request.method !== "HEAD") {
    init.body = context.request.body;
    init.duplex = "half";
  }

  let res: Response;
  try {
    res = await fetch(target, init);
  } catch {
    const headers = corsHeaders(incoming.origin);
    headers.set("Content-Type", "application/json");
    return new Response(JSON.stringify({ error: "API unreachable" }), {
      status: 502,
      headers,
    });
  }

  const out = new Headers(res.headers);
  // The runtime already decoded the body. Leaving these on produces a 502.
  for (const name of ["content-encoding", "content-length", "transfer-encoding", "connection", "keep-alive"]) {
    out.delete(name);
  }
  out.set("Access-Control-Allow-Origin", incoming.origin || "*");
  return new Response(res.body, { status: res.status, headers: out });
};
