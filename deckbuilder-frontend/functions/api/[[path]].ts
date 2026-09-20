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
