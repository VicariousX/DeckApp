interface Env {
  PROXY_ART: R2Bucket;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function extFor(type: string): string {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  if (type === "image/gif") return "gif";
  return "jpg";
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const bucket = context.env.PROXY_ART;
  if (!bucket) return json({ error: "R2 binding PROXY_ART is not configured." }, 500);

  const form = await context.request.formData();
  const file = form.get("file");
  const oracle = String(form.get("oracle_id") || "").toLowerCase().replace(/[^a-z0-9-]/g, "");
  const side = form.get("side") === "back" ? "back" : "front";
  if (!(file instanceof File) || !oracle) {
    return json({ error: "file and oracle_id are required." }, 400);
  }
  if (!file.type.startsWith("image/")) {
    return json({ error: "File must be an image." }, 400);
  }
  if (file.size > 8 * 1024 * 1024) {
    return json({ error: "Image must be under 8MB." }, 400);
  }

  const key = `proxy/${oracle}/${side}.${extFor(file.type)}`;
  await bucket.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type || "image/jpeg" },
  });

  const url = new URL(context.request.url);
  return json({ key, url: `${url.origin}/api/proxy-art/file?key=${encodeURIComponent(key)}` });
};

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const bucket = context.env.PROXY_ART;
  if (!bucket) return json({ error: "R2 binding PROXY_ART is not configured." }, 500);
  return json({ ok: true, bound: true });
};
