import type { DragEvent as ReactDragEvent } from "react";
import type { ScryfallCard } from "../types/scryfallCard";

export type DraggedCardHint = {
  name: string;
  id?: string;
  set?: string;
  collector_number?: string;
  uri?: string;
};

export function scryfallPageUri(card: ScryfallCard): string {
  if (card.scryfall_uri) return card.scryfall_uri;
  if (card.uri) return card.uri;
  if (card.set && card.collector_number) {
    return `https://scryfall.com/card/${card.set}/${card.collector_number}`;
  }
  return `https://scryfall.com/search?q=${encodeURIComponent("!" + card.name)}`;
}

export function startExternalCardDrag(
  e: ReactDragEvent,
  card: ScryfallCard
): void {
  const name = card.name ?? "";
  const uri = scryfallPageUri(card);
  const payload: DraggedCardHint = {
    name,
    id: card.id,
    set: card.set,
    collector_number: card.collector_number,
    uri,
  };
  try {
    e.dataTransfer.setData("application/x-deckapp-card", JSON.stringify(payload));
  } catch {
    /* some browsers reject custom types */
  }
  e.dataTransfer.setData("text/uri-list", uri);
  e.dataTransfer.setData("text/plain", name);
  e.dataTransfer.effectAllowed = "copy";
}

function namesFromPlain(text: string): string[] {
  const out: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    let line = raw.trim();
    if (!line) continue;
    if (/^https?:\/\//i.test(line)) continue;
    line = line.replace(/^\d+\s*[xX]?\s+/, "").replace(/\s*\([^)]+\)\s*$/, "");
    if (line && !line.startsWith("#")) out.push(line);
  }
  return out;
}

function namesFromUris(text: string): string[] {
  const out: string[] = [];
  for (const raw of text.split(/\s+/)) {
    const url = raw.trim();
    if (!url) continue;
    const scry = url.match(/scryfall\.com\/card\/[^/]+\/[^/]+\/([^/?#]+)/i);
    if (scry?.[1]) {
      out.push(decodeURIComponent(scry[1]).replace(/-/g, " "));
      continue;
    }
    const named = url.match(/[?&]q=([^&]+)/i);
    if (named?.[1] && url.includes("scryfall")) {
      const q = decodeURIComponent(named[1]).replace(/^!/, "").replace(/\+/g, " ");
      if (q && !q.includes(":")) out.push(q);
    }
  }
  return out;
}

function namesFromHtml(html: string): string[] {
  const out: string[] = [];
  const alts = html.matchAll(/alt="([^"]+)"/gi);
  for (const m of alts) {
    const n = m[1].trim();
    if (n && n.length < 80) out.push(n);
  }
  const hrefs = html.matchAll(/href="(https?:\/\/[^"]*scryfall\.com[^"]*)"/gi);
  for (const m of hrefs) out.push(...namesFromUris(m[1]));
  return out;
}

export function parseExternalCardDrop(dt: DataTransfer): DraggedCardHint[] {
  const custom = dt.getData("application/x-deckapp-card");
  if (custom) {
    try {
      const parsed = JSON.parse(custom) as DraggedCardHint;
      if (parsed?.name) return [parsed];
    } catch {
      /* ignore */
    }
  }
  const names = new Set<string>();
  const uris = dt.getData("text/uri-list") || dt.getData("text/uri-list".toLowerCase());
  for (const n of namesFromUris(uris)) names.add(n);
  for (const n of namesFromHtml(dt.getData("text/html"))) names.add(n);
  for (const n of namesFromPlain(dt.getData("text/plain") || dt.getData("Text"))) {
    names.add(n);
  }
  return [...names].map((name) => ({ name }));
}
