interface Env {
  PROXY_ART: R2Bucket;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const bucket = context.env.PROXY_ART;
  if (!bucket) return new Response("R2 not configured", { status: 500 });
  const key = new URL(context.request.url).searchParams.get("key") || "";
  if (!key.startsWith("proxy/")) return new Response("Bad key", { status: 400 });
  const object = await bucket.get(key);
  if (!object) return new Response("Not found", { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("Cache-Control", "public, max-age=31536000, immutable");
  headers.set("Access-Control-Allow-Origin", "*");
  return new Response(object.body, { headers });
};
