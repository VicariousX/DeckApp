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
  if (type === "image/svg+xml") return "svg";
  return "jpg";
}

/** Turn common share links into direct download URLs. */
function resolveSourceUrl(raw: string): string {
  let url = raw.trim();
  const driveFile = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (driveFile) {
    return `https://drive.google.com/uc?export=download&id=${driveFile[1]}&confirm=t`;
  }
  const driveId = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (url.includes("drive.google.com") && driveId) {
    return `https://drive.google.com/uc?export=download&id=${driveId[1]}&confirm=t`;
  }
  if (url.includes("dropbox.com")) {
    url = url.replace("www.dropbox.com", "dl.dropboxusercontent.com");
    url = url.replace(/[?&]dl=0/, "");
    if (!url.includes("dl=1") && !url.includes("raw=1")) {
      url += (url.includes("?") ? "&" : "?") + "dl=1";
    }
    return url;
  }
  return url;
}

async function fetchImage(sourceUrl: string): Promise<{ buffer: ArrayBuffer; contentType: string }> {
  let url = resolveSourceUrl(sourceUrl);
  let res = await fetch(url, {
    redirect: "follow",
    headers: { "User-Agent": "DeckApp-ProxyImporter/1.0" },
  });
  if (!res.ok) {
    throw new Error(`Could not fetch image (${res.status}). For Google Drive, make sure the file is shared as “Anyone with the link”.`);
  }
  let contentType = (res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  if (contentType.includes("text/html") || contentType === "") {
    const html = await res.text();
    const confirmMatch = html.match(/confirm=([0-9A-Za-z_-]+)/) || html.match(/id="download-form"[^>]*action="([^"]+)"/);
    if (confirmMatch) {
      const next = confirmMatch[1].startsWith("http")
        ? confirmMatch[1]
        : `https://drive.google.com/uc?export=download&confirm=${confirmMatch[1]}&id=${url.match(/id=([^&]+)/)?.[1] || ""}`;
      res = await fetch(next, { redirect: "follow", headers: { "User-Agent": "DeckApp-ProxyImporter/1.0" } });
      contentType = (res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    }
  }
  if (!contentType.startsWith("image/")) {
    throw new Error(`URL did not return an image (got ${contentType || "unknown"}). For Google Drive, use a public share link.`);
  }
  const buffer = await res.arrayBuffer();
  if (buffer.byteLength > 8 * 1024 * 1024) throw new Error("Image must be under 8MB.");
  if (buffer.byteLength < 32) throw new Error("Downloaded file is too small to be a valid image.");
  return { buffer, contentType };
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const bucket = context.env.PROXY_ART;
  if (!bucket) return json({ error: "R2 binding PROXY_ART is not configured." }, 500);
  const form = await context.request.formData();
  const oracle = String(form.get("oracle_id") || "").toLowerCase().replace(/[^a-z0-9-]/g, "");
  const side = form.get("side") === "back" ? "back" : "front";
  if (!oracle) return json({ error: "oracle_id is required." }, 400);
  let buffer: ArrayBuffer;
  let contentType: string;
  const file = form.get("file");
  const sourceUrl = String(form.get("source_url") || "").trim();
  if (file instanceof File && file.size > 0) {
    if (!file.type.startsWith("image/")) return json({ error: "File must be an image." }, 400);
    if (file.size > 8 * 1024 * 1024) return json({ error: "Image must be under 8MB." }, 400);
    buffer = await file.arrayBuffer();
    contentType = file.type || "image/jpeg";
  } else if (sourceUrl) {
    try {
      const fetched = await fetchImage(sourceUrl);
      buffer = fetched.buffer;
      contentType = fetched.contentType;
    } catch (err) {
      return json({ error: err instanceof Error ? err.message : "Failed to import URL." }, 400);
    }
  } else {
    return json({ error: "Provide a file or a source_url." }, 400);
  }
  const key = `proxy/${oracle}/${side}.${extFor(contentType)}`;
  await bucket.put(key, buffer, { httpMetadata: { contentType } });
  const url = new URL(context.request.url);
  const bust = Date.now();
  return json({ key, url: `${url.origin}/api/proxy-art/file?key=${encodeURIComponent(key)}&v=${bust}` });
};


export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const bucket = context.env.PROXY_ART;
  if (!bucket) return json({ error: "R2 binding PROXY_ART is not configured." }, 500);
  const url = new URL(context.request.url);
  const oracle = (url.searchParams.get("oracle_id") || "").toLowerCase().replace(/[^a-z0-9-]/g, "");
  const keyParam = url.searchParams.get("key") || "";
  if (keyParam) {
    // Single key delete (must be under proxy/)
    if (!keyParam.startsWith("proxy/")) return json({ error: "Invalid key." }, 400);
    await bucket.delete(keyParam);
    return json({ deleted: 1, keys: [keyParam] });
  }
  if (!oracle) return json({ error: "oracle_id or key is required." }, 400);
  const prefix = `proxy/${oracle}/`;
  const listed = await bucket.list({ prefix });
  const keys = listed.objects.map((o) => o.key);
  if (keys.length) await bucket.delete(keys);
  return json({ deleted: keys.length, keys });
};

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const bucket = context.env.PROXY_ART;
  if (!bucket) return json({ error: "R2 binding PROXY_ART is not configured." }, 500);
  return json({ ok: true, bound: true });
};
