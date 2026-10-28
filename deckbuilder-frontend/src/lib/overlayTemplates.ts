import { parseManaCost, symbolToSvgUri } from "../utils/symbols";

export const CARD_W = 750;
export const CARD_H = 1050;
const STORAGE_KEY = "deckapp.proxy.templates";

export type OverlayElementType = "name" | "mana" | "typeLine" | "rules" | "pt" | "customText";
export type ColorSource = "custom" | "art";

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
  verticalAlign: "top" | "middle" | "bottom";
  customText?: string;
  zIndex: number;
  colorSource: ColorSource;
  backgroundSource: ColorSource;
  borderSource: ColorSource;
  colorOpacity: number;
  backgroundOpacity: number;
  borderOpacity: number;
  /** @deprecated use borderSource */
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

function normalize(el: Partial<OverlayElement> & { id: string; type: OverlayElementType }): OverlayElement {
  const borderSource: ColorSource = el.borderSource ?? (el.useArtBorder ? "art" : "custom");
  return {
    id: el.id,
    type: el.type,
    x: el.x ?? 40,
    y: el.y ?? 40,
    width: el.width ?? 200,
    height: el.height ?? 48,
    fontSize: el.fontSize ?? 24,
    fontWeight: el.fontWeight ?? "normal",
    fontStyle: el.fontStyle ?? "normal",
    color: el.color ?? "#ffffff",
    background: el.background ?? "rgba(0,0,0,0.5)",
    borderColor: el.borderColor ?? "#888888",
    borderWidth: el.borderWidth ?? 0,
    textAlign: el.textAlign ?? "left",
    verticalAlign: el.verticalAlign ?? "middle",
    customText: el.customText,
    zIndex: el.zIndex ?? 0,
    colorSource: el.colorSource ?? "custom",
    backgroundSource: el.backgroundSource ?? "custom",
    borderSource,
    colorOpacity: el.colorOpacity ?? 1,
    backgroundOpacity: el.backgroundOpacity ?? 1,
    borderOpacity: el.borderOpacity ?? 1,
  };
}

export function defaultFullArtTemplate(): OverlayTemplate {
  return {
    id: "default-full-art",
    name: "Full Art",
    updatedAt: new Date().toISOString(),
    elements: [
      normalize({ id: "name", type: "name", x: 24, y: 20, width: 700, height: 50, fontSize: 32, fontWeight: "bold", color: "#ffffff", background: "rgba(0,0,0,0.55)", borderWidth: 0, textAlign: "left", verticalAlign: "middle", zIndex: 1 }),
      normalize({ id: "mana", type: "mana", x: 480, y: 24, width: 240, height: 42, fontSize: 28, background: "transparent", borderWidth: 0, textAlign: "right", verticalAlign: "middle", zIndex: 2 }),
      normalize({ id: "type", type: "typeLine", x: 24, y: 80, width: 700, height: 40, fontSize: 24, fontStyle: "italic", color: "#ffffff", background: "rgba(0,0,0,0.45)", borderWidth: 0, textAlign: "left", verticalAlign: "middle", zIndex: 1 }),
      normalize({ id: "rules", type: "rules", x: 28, y: 750, width: 694, height: 240, fontSize: 22, color: "#111111", background: "rgba(245,245,245,0.82)", borderColor: "#888888", borderWidth: 5, textAlign: "left", verticalAlign: "top", borderSource: "art", zIndex: 1 }),
      normalize({ id: "pt", type: "pt", x: 600, y: 970, width: 120, height: 50, fontSize: 26, fontWeight: "bold", color: "#ffffff", background: "rgba(0,0,0,0.7)", borderColor: "#888888", borderWidth: 3, textAlign: "center", verticalAlign: "middle", borderSource: "art", zIndex: 2 }),
    ],
  };
}

export function loadTemplates(): OverlayTemplate[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [defaultFullArtTemplate()];
    const parsed = JSON.parse(raw) as OverlayTemplate[];
    if (!Array.isArray(parsed) || parsed.length === 0) return [defaultFullArtTemplate()];
    return parsed.map((t) => ({
      ...t,
      elements: (t.elements || []).map((e) => normalize(e)),
    }));
  } catch {
    return [defaultFullArtTemplate()];
  }
}

export function saveTemplates(templates: OverlayTemplate[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
}

export function upsertTemplate(template: OverlayTemplate): OverlayTemplate[] {
  const all = loadTemplates();
  const next = { ...template, updatedAt: new Date().toISOString(), elements: template.elements.map((e) => normalize(e)) };
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

export function newElement(type: OverlayElementType, z = 0): OverlayElement {
  return normalize({
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
    borderColor: "#888888",
    borderWidth: 0,
    textAlign: type === "pt" ? "center" : "left",
    verticalAlign: type === "rules" ? "top" : "middle",
    customText: type === "customText" ? "Custom text" : undefined,
    zIndex: z,
  });
}

// --- Color helpers ---

function parseRgb(color: string): [number, number, number] {
  const hex = color.trim();
  if (hex.startsWith("#")) {
    let h = hex.slice(1);
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const m = hex.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (m) return [Number(m[1]), Number(m[2]), Number(m[3])];
  return [136, 136, 136];
}

export function withOpacity(color: string, opacity: number): string {
  const [r, g, b] = parseRgb(color);
  const a = Math.max(0, Math.min(1, opacity));
  return `rgba(${r},${g},${b},${a})`;
}

export function resolveColor(source: ColorSource, custom: string, opacity: number, artColor: string): string {
  const base = source === "art" ? artColor : custom;
  return withOpacity(base, opacity);
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
  const lift = (v: number) => Math.min(255, Math.round((v / n) * 0.65 + 90));
  return `rgb(${lift(r)},${lift(g)},${lift(b)})`;
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
  artColor: string
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

  const ordered = [...template.elements].sort((a, b) => a.zIndex - b.zIndex);

  for (const el of ordered) {
    const bg = resolveColor(el.backgroundSource, el.background, el.backgroundOpacity, artColor);
    const border = resolveColor(el.borderSource, el.borderColor, el.borderOpacity, artColor);
    const fill = resolveColor(el.colorSource, el.color, el.colorOpacity, artColor);

    if (el.backgroundSource === "art" || (el.background && el.background !== "transparent")) {
      ctx.fillStyle = bg;
      ctx.fillRect(el.x, el.y, el.width, el.height);
    }
    if (el.borderWidth > 0) {
      ctx.strokeStyle = border;
      ctx.lineWidth = el.borderWidth;
      ctx.strokeRect(el.x, el.y, el.width, el.height);
    }

    if (el.type === "mana") {
      const syms = parseManaCost(fields.mana);
      if (!syms.length) continue;
      const imgs = await Promise.all(syms.map((s) => loadSymbol(s)));
      const size = Math.min(el.height - 6, el.fontSize);
      const totalW = imgs.length * (size + 4) - 4;
      let x = el.x + 8;
      if (el.textAlign === "center") x = el.x + (el.width - totalW) / 2;
      else if (el.textAlign === "right") x = el.x + el.width - 8 - totalW;
      let y = el.y + 4;
      if (el.verticalAlign === "middle") y = el.y + (el.height - size) / 2;
      else if (el.verticalAlign === "bottom") y = el.y + el.height - size - 4;
      for (const im of imgs) {
        if (im.complete && im.naturalWidth) ctx.drawImage(im, x, y, size, size);
        x += size + 4;
      }
      continue;
    }

    const text = textFor(el, fields);
    if (!text) continue;

    ctx.fillStyle = fill;
    ctx.font = `${el.fontStyle} ${el.fontWeight} ${el.fontSize}px serif`;
    ctx.textBaseline = "top";

    const pad = 8;
    const symSize = Math.round(el.fontSize * 0.9);
    const lines = text.split("\n");
    const lineH = el.fontSize + 6;
    const blockH = lines.length * lineH;

    let ty = el.y + pad;
    if (el.verticalAlign === "middle") ty = el.y + Math.max(pad, (el.height - blockH) / 2);
    else if (el.verticalAlign === "bottom") ty = el.y + el.height - pad - blockH;

    for (const line of lines) {
      if (ty > el.y + el.height - 4) break;
      const tokens = tokenize(line);
      const symImgs = new Map<string, HTMLImageElement>();
      for (const t of tokens) {
        if (t.kind === "sym") symImgs.set(t.code, await loadSymbol(t.code));
      }
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
          if (im && im.complete && im.naturalWidth) ctx.drawImage(im, x, ty, symSize, symSize);
          x += symSize + 4;
        } else {
          const words = t.text.split(/(\s+)/);
          for (const w of words) {
            const wW = ctx.measureText(w).width;
            if (x + wW > el.x + el.width - pad && w.trim()) {
              ty += lineH;
              x = el.x + pad;
              if (ty > el.y + el.height - 4) break;
            }
            ctx.fillText(w, x, ty);
            x += wW;
          }
        }
      }
      ty += lineH;
    }
  }
}
