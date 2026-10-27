import { parseManaCost, symbolToSvgUri } from "../utils/symbols";

export const CARD_W = 750;
export const CARD_H = 1050;
const STORAGE_KEY = "deckapp.proxy.templates";

export type OverlayElementType = "name" | "mana" | "typeLine" | "rules" | "pt" | "customText";

export type OverlayElement = {
  id: string;
  type: OverlayElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontWeight: "normal" | "bold";
  fontStyle: "normal" | "italic";
  color: string;
  background: string;
  borderColor: string;
  borderWidth: number;
  textAlign: "left" | "center" | "right";
  customText?: string;
  useArtBorder?: boolean;
};

export type OverlayTemplate = {
  id: string;
  name: string;
  elements: OverlayElement[];
  updatedAt: string;
};

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function defaultFullArtTemplate(): OverlayTemplate {
  return {
    id: "default-full-art",
    name: "Full Art",
    updatedAt: new Date().toISOString(),
    elements: [
      {
        id: "name",
        type: "name",
        x: 24,
        y: 20,
        width: 700,
        height: 50,
        fontSize: 32,
        fontWeight: "bold",
        fontStyle: "normal",
        color: "#ffffff",
        background: "rgba(0,0,0,0.55)",
        borderColor: "transparent",
        borderWidth: 0,
        textAlign: "left",
      },
      {
        id: "mana",
        type: "mana",
        x: 480,
        y: 24,
        width: 240,
        height: 42,
        fontSize: 28,
        fontWeight: "normal",
        fontStyle: "normal",
        color: "#ffffff",
        background: "transparent",
        borderColor: "transparent",
        borderWidth: 0,
        textAlign: "right",
      },
      {
        id: "type",
        type: "typeLine",
        x: 24,
        y: 80,
        width: 700,
        height: 40,
        fontSize: 24,
        fontWeight: "normal",
        fontStyle: "italic",
        color: "#ffffff",
        background: "rgba(0,0,0,0.45)",
        borderColor: "transparent",
        borderWidth: 0,
        textAlign: "left",
      },
      {
        id: "rules",
        type: "rules",
        x: 28,
        y: 750,
        width: 694,
        height: 240,
        fontSize: 22,
        fontWeight: "normal",
        fontStyle: "normal",
        color: "#111111",
        background: "rgba(245,245,245,0.82)",
        borderColor: "#888888",
        borderWidth: 5,
        textAlign: "left",
        useArtBorder: true,
      },
      {
        id: "pt",
        type: "pt",
        x: 600,
        y: 970,
        width: 120,
        height: 50,
        fontSize: 26,
        fontWeight: "bold",
        fontStyle: "normal",
        color: "#ffffff",
        background: "rgba(0,0,0,0.7)",
        borderColor: "#888888",
        borderWidth: 3,
        textAlign: "center",
        useArtBorder: true,
      },
    ],
  };
}

export function loadTemplates(): OverlayTemplate[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [defaultFullArtTemplate()];
    const parsed = JSON.parse(raw) as OverlayTemplate[];
    if (!Array.isArray(parsed) || parsed.length === 0) return [defaultFullArtTemplate()];
    return parsed;
  } catch {
    return [defaultFullArtTemplate()];
  }
}

export function saveTemplates(templates: OverlayTemplate[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
}

export function upsertTemplate(template: OverlayTemplate): OverlayTemplate[] {
  const all = loadTemplates();
  const next = { ...template, updatedAt: new Date().toISOString() };
  const idx = all.findIndex((t) => t.id === next.id);
  if (idx >= 0) all[idx] = next;
  else all.push(next);
  saveTemplates(all);
  return all;
}

export function deleteTemplate(id: string): OverlayTemplate[] {
  const all = loadTemplates().filter((t) => t.id !== id);
  if (all.length === 0) all.push(defaultFullArtTemplate());
  saveTemplates(all);
  return all;
}

export function newElement(type: OverlayElementType): OverlayElement {
  return {
    id: uid(),
    type,
    x: 40,
    y: 200,
    width: type === "pt" ? 120 : type === "mana" ? 200 : 600,
    height: type === "rules" ? 200 : 48,
    fontSize: 24,
    fontWeight: type === "name" || type === "pt" ? "bold" : "normal",
    fontStyle: type === "typeLine" ? "italic" : "normal",
    color: "#ffffff",
    background: "rgba(0,0,0,0.5)",
    borderColor: "transparent",
    borderWidth: 0,
    textAlign: type === "pt" ? "center" : "left",
    customText: type === "customText" ? "Custom text" : undefined,
  };
}

// --- Canvas rendering ---

const symbolCache = new Map<string, HTMLImageElement>();
function loadSymbol(code: string): Promise<HTMLImageElement> {
  const existing = symbolCache.get(code);
  if (existing && existing.complete && existing.naturalWidth) return Promise.resolve(existing);
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      symbolCache.set(code, img);
      resolve(img);
    };
    img.onerror = () => resolve(img);
    img.src = symbolToSvgUri(code);
  });
}

type Token = { kind: "text"; text: string } | { kind: "sym"; code: string };

function tokenize(text: string): Token[] {
  const parts = text.split(/(\{[^}]+\})/g);
  return parts
    .filter((p) => p.length > 0)
    .map((p) =>
      p.startsWith("{") && p.endsWith("}") ? { kind: "sym", code: p } : { kind: "text", text: p }
    );
}

export type ProxyFields = {
  name: string;
  mana: string;
  typeLine: string;
  rules: string;
  pt: string;
};

function textFor(el: OverlayElement, fields: ProxyFields): string {
  if (el.type === "name") return fields.name || "Card name";
  if (el.type === "typeLine") return fields.typeLine || "Type line";
  if (el.type === "rules") return fields.rules || "";
  if (el.type === "pt") return fields.pt || "";
  if (el.type === "customText") return el.customText || "";
  return "";
}

export async function renderTemplate(
  ctx: CanvasRenderingContext2D,
  template: OverlayTemplate,
  fields: ProxyFields,
  art: HTMLImageElement | null,
  artOffset: { x: number; y: number },
  artScale: number,
  artBorderColor: string
): Promise<void> {
  ctx.fillStyle = "#111";
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  if (art) {
    const scale = Math.max(CARD_W / art.width, CARD_H / art.height) * artScale;
    const dw = art.width * scale;
    const dh = art.height * scale;
    const dx = (CARD_W - dw) / 2 + artOffset.x;
    const dy = (CARD_H - dh) / 2 + artOffset.y;
    ctx.drawImage(art, dx, dy, dw, dh);
  }

  for (const el of template.elements) {
    const border = el.useArtBorder ? artBorderColor : el.borderColor;

    // Background
    if (el.background && el.background !== "transparent") {
      ctx.fillStyle = el.background;
      ctx.fillRect(el.x, el.y, el.width, el.height);
    }
    if (el.borderWidth > 0 && border && border !== "transparent") {
      ctx.strokeStyle = border;
      ctx.lineWidth = el.borderWidth;
      ctx.strokeRect(el.x, el.y, el.width, el.height);
    }

    if (el.type === "mana") {
      const syms = parseManaCost(fields.mana);
      if (!syms.length) continue;
      const imgs = await Promise.all(syms.map((s) => loadSymbol(s)));
      const size = Math.min(el.height - 6, el.fontSize);
      let x = el.textAlign === "right" ? el.x + el.width - 8 : el.x + 8;
      const y = el.y + (el.height - size) / 2;
      const step = size + 4;
      if (el.textAlign === "right") {
        for (let i = imgs.length - 1; i >= 0; i--) {
          x -= step;
          const im = imgs[i];
          if (im.complete && im.naturalWidth) ctx.drawImage(im, x, y, size, size);
        }
      } else {
        for (const im of imgs) {
          if (im.complete && im.naturalWidth) ctx.drawImage(im, x, y, size, size);
          x += step;
        }
      }
      continue;
    }

    const text = textFor(el, fields);
    if (!text) continue;

    ctx.fillStyle = el.color;
    ctx.font = `${el.fontStyle} ${el.fontWeight} ${el.fontSize}px serif`;
    ctx.textBaseline = "top";

    const pad = 8;
    const maxW = el.width - pad * 2;
    const symSize = Math.round(el.fontSize * 0.9);
    const lines = text.split("\n");
    let ty = el.y + pad;

    for (const line of lines) {
      if (ty > el.y + el.height - el.fontSize) break;
      const tokens = tokenize(line);
      const symImgs = new Map<string, HTMLImageElement>();
      for (const t of tokens) {
        if (t.kind === "sym") symImgs.set(t.code, await loadSymbol(t.code));
      }

      // Measure line width for alignment
      let lineW = 0;
      for (const t of tokens) {
        if (t.kind === "sym") lineW += symSize + 4;
        else lineW += ctx.measureText(t.text).width;
      }
      let x = el.x + pad;
      if (el.textAlign === "center") x = el.x + (el.width - lineW) / 2;
      else if (el.textAlign === "right") x = el.x + el.width - pad - lineW;

      for (const t of tokens) {
        if (t.kind === "sym") {
          const im = symImgs.get(t.code);
          if (im && im.complete && im.naturalWidth) {
            ctx.drawImage(im, x, ty, symSize, symSize);
          }
          x += symSize + 4;
        } else {
          // Simple word wrap within remaining width
          const words = t.text.split(/(\s+)/);
          for (const w of words) {
            const wW = ctx.measureText(w).width;
            if (x + wW > el.x + el.width - pad && w.trim()) {
              ty += el.fontSize + 4;
              x = el.x + pad;
              if (ty > el.y + el.height - el.fontSize) break;
            }
            ctx.fillText(w, x, ty);
            x += wW;
          }
        }
      }
      ty += el.fontSize + 6;
    }
  }
}

export function averageColor(img: HTMLImageElement): string {
  const c = document.createElement("canvas");
  c.width = 32;
  c.height = 32;
  const ctx = c.getContext("2d");
  if (!ctx) return "#5a5a5a";
  ctx.drawImage(img, 0, 0, 32, 32);
  const data = ctx.getImageData(0, 0, 32, 32).data;
  let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i < data.length; i += 4) {
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
    n++;
  }
  const lift = (v: number) => Math.min(255, Math.round(v / n * 0.65 + 90));
  return `rgb(${lift(r)},${lift(g)},${lift(b)})`;
}
