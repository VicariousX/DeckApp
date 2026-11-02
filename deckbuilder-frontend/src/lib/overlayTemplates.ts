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
  fontWeight: "normal" | "bold" | "300" | "400" | "500" | "700";
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
  padding: number;
  cornerRadius: number;
  /** Shrink font so text fits inside the element. */
  fitText: boolean;
  /** Shrink element width to the measured text. */
  fitWidth: boolean;
  /** Line height multiplier (1.0 = tight, 1.4 = loose). */
  lineHeight: number;
  /** Extra space between characters in px. */
  letterSpacing: number;
  /** Font family stack. */
  fontFamily: string;
  /** Optional text shadow for legibility over art. */
  textShadow: string;
  /** Max lines before clipping (0 = unlimited). */
  maxLines: number;
  /** How to handle overflow. */
  wrapMode: "wrap" | "nowrap" | "ellipsis";
  /** Text outline color (empty = none). */
  textOutline: string;
  /** Text outline width in px. */
  textOutlineWidth: number;
  /** Grow element height to fit content. */
  autoGrow: boolean;
  /** Highlighter color behind text (empty = off). */
  highlightColor: string;
  /** Highlighter opacity 0–1. */
  highlightOpacity: number;
  /** Paint style for the highlighter. */
  highlightStyle: "brush" | "marker" | "underline" | "wash" | "ribbon" | "double" | "fade" | "chalk" | "paint";
  /** Extra horizontal spread around the text in px. */
  highlightSpread: number;
  /** Extra vertical spread around the text in px. */
  highlightSpreadY: number;
  /** One stroke per visual line, or one stroke for the whole block. */
  highlightMode: "line" | "block";
  /** Nudge the highlighter horizontally relative to the text. */
  highlightOffsetX: number;
  /** Nudge the highlighter vertically relative to the text. */
  highlightOffsetY: number;
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
    padding: el.padding ?? 8,
    cornerRadius: el.cornerRadius ?? 0,
    fitText: el.fitText ?? false,
    fitWidth: el.fitWidth ?? false,
    lineHeight: el.lineHeight ?? 1.25,
    letterSpacing: el.letterSpacing ?? 0,
    fontFamily: el.fontFamily ?? "serif",
    textShadow: el.textShadow ?? "",
    maxLines: el.maxLines ?? 0,
    wrapMode: el.wrapMode ?? "wrap",
    textOutline: el.textOutline ?? "",
    textOutlineWidth: el.textOutlineWidth ?? 0,
    autoGrow: el.autoGrow ?? false,
    highlightColor: el.highlightColor ?? "",
    highlightOpacity: el.highlightOpacity ?? 0.55,
    highlightStyle: el.highlightStyle ?? "brush",
    highlightSpread: el.highlightSpread ?? 6,
    highlightSpreadY: el.highlightSpreadY ?? 4,
    highlightMode: el.highlightMode ?? "line",
    highlightOffsetX: el.highlightOffsetX ?? 0,
    highlightOffsetY: el.highlightOffsetY ?? 0,
  };
}

export function defaultFullArtTemplate(): OverlayTemplate {
  return {
    id: "default-full-art",
    name: "Full Art",
    updatedAt: new Date().toISOString(),
    elements: [
      normalize({
        id: "name",
        type: "name",
        x: 24,
        y: 18,
        width: 700,
        height: 48,
        fontSize: 34,
        fontWeight: "bold",
        color: "#ffffff",
        background: "transparent",
        borderWidth: 0,
        textAlign: "left",
        verticalAlign: "middle",
        textShadow: "#000000",
        textOutline: "#000000",
        textOutlineWidth: 1,
        highlightColor: "#1a1a1a",
        highlightOpacity: 0.45,
        highlightStyle: "brush",
        highlightSpread: 8,
        zIndex: 1,
      }),
      normalize({
        id: "mana",
        type: "mana",
        x: 480,
        y: 20,
        width: 240,
        height: 42,
        fontSize: 28,
        background: "transparent",
        borderWidth: 0,
        textAlign: "right",
        verticalAlign: "middle",
        zIndex: 2,
      }),
      normalize({
        id: "type",
        type: "typeLine",
        x: 24,
        y: 72,
        width: 700,
        height: 36,
        fontSize: 22,
        fontStyle: "italic",
        color: "#ffffff",
        background: "transparent",
        borderWidth: 0,
        textAlign: "left",
        verticalAlign: "middle",
        textShadow: "#000000",
        highlightColor: "#1a1a1a",
        highlightOpacity: 0.35,
        highlightStyle: "brush",
        highlightSpread: 6,
        zIndex: 1,
      }),
      normalize({
        id: "rules",
        type: "rules",
        x: 32,
        y: 720,
        width: 686,
        height: 220,
        fontSize: 20,
        color: "#111111",
        background: "rgba(245,245,245,0.78)",
        borderColor: "#888888",
        borderWidth: 3,
        textAlign: "left",
        verticalAlign: "top",
        borderSource: "art",
        padding: 12,
        cornerRadius: 6,
        zIndex: 1,
      }),
      normalize({
        id: "pt",
        type: "pt",
        x: 600,
        y: 960,
        width: 120,
        height: 48,
        fontSize: 24,
        fontWeight: "bold",
        color: "#ffffff",
        background: "rgba(0,0,0,0.65)",
        borderColor: "#888888",
        borderWidth: 2,
        textAlign: "center",
        verticalAlign: "middle",
        borderSource: "art",
        cornerRadius: 4,
        zIndex: 2,
      }),
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


function hash01(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export type HighlightStyle = "brush" | "marker" | "underline" | "wash" | "ribbon" | "double" | "fade" | "chalk" | "paint";

/** Artistic paint-stroke highlighter behind text. */
function drawHighlighter(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  opacity: number,
  style: HighlightStyle,
  spreadX: number,
  spreadY: number,
  seed: number
) {
  if (w < 4 || h < 4) return;
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, opacity));
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const sx = x - spreadX;
  const sy = y - spreadY;
  const sw = w + spreadX * 2;
  const sh = h + spreadY * 2;

  if (style === "underline") {
    const base = sy + sh * 0.82;
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(3, sh * 0.22);
    ctx.beginPath();
    ctx.moveTo(sx, base);
    for (let i = 1; i <= 6; i++) {
      ctx.lineTo(sx + (sw * i) / 6, base + (hash01(seed + i) - 0.5) * sh * 0.18);
    }
    ctx.stroke();
  } else if (style === "marker") {
    const my = sy + sh * 0.08;
    const mh = sh * 0.84;
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = Math.max(4, sh * 0.3);
    roundRect(ctx, sx, my, sw, mh, Math.min(mh / 2, 12));
    ctx.fill();
  } else if (style === "wash") {
    const g = ctx.createLinearGradient(sx, sy, sx, sy + sh);
    g.addColorStop(0, "transparent");
    g.addColorStop(0.25, color);
    g.addColorStop(0.75, color);
    g.addColorStop(1, "transparent");
    ctx.fillStyle = g;
    ctx.shadowColor = color;
    ctx.shadowBlur = Math.max(8, sh * 0.4);
    ctx.fillRect(sx, sy, sw, sh);
  } else if (style === "ribbon") {
    ctx.fillStyle = color;
    ctx.beginPath();
    const mid = sy + sh * 0.5;
    ctx.moveTo(sx, mid);
    ctx.quadraticCurveTo(sx + sw * 0.15, sy + sh * 0.15, sx + sw * 0.5, sy + sh * 0.22);
    ctx.quadraticCurveTo(sx + sw * 0.85, sy + sh * 0.3, sx + sw, mid);
    ctx.quadraticCurveTo(sx + sw * 0.85, sy + sh * 0.78, sx + sw * 0.5, sy + sh * 0.82);
    ctx.quadraticCurveTo(sx + sw * 0.15, sy + sh * 0.86, sx, mid);
    ctx.closePath();
    ctx.fill();
  } else if (style === "double") {
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(2, sh * 0.16);
    for (const off of [0.32, 0.68]) {
      ctx.beginPath();
      const base = sy + sh * off;
      ctx.moveTo(sx, base);
      for (let i = 1; i <= 5; i++) {
        ctx.lineTo(sx + (sw * i) / 5, base + (hash01(seed + off * 10 + i) - 0.5) * sh * 0.08);
      }
      ctx.stroke();
    }
  } else if (style === "fade") {
    const g = ctx.createLinearGradient(sx, sy, sx + sw, sy);
    g.addColorStop(0, "transparent");
    g.addColorStop(0.12, color);
    g.addColorStop(0.88, color);
    g.addColorStop(1, "transparent");
    ctx.fillStyle = g;
    roundRect(ctx, sx, sy + sh * 0.12, sw, sh * 0.76, sh * 0.3);
    ctx.fill();
  } else if (style === "chalk") {
    ctx.strokeStyle = color;
    const steps = 14;
    for (let pass = 0; pass < 3; pass++) {
      ctx.globalAlpha = opacity * (0.25 + hash01(seed + pass) * 0.3);
      ctx.lineWidth = Math.max(1.5, sh * (0.12 + hash01(seed + pass * 3) * 0.1));
      ctx.beginPath();
      for (let i = 0; i <= steps; i++) {
        if (hash01(seed + pass * 20 + i) < 0.18) continue;
        const px = sx + (sw * i) / steps;
        const py = sy + sh * 0.45 + (hash01(seed + i * 3 + pass) - 0.5) * sh * 0.4;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
  } else if (style === "paint") {
    // Soft brush: solid rounded core, then many short overlapping strokes along the edges
    // that fade into the core. No jagged polygon, no thin stray lines.
    const coreY = sy + sh * 0.18;
    const coreH = sh * 0.64;
    ctx.fillStyle = color;
    roundRect(ctx, sx + sw * 0.02, coreY, sw * 0.96, coreH, Math.min(coreH / 2, 8));
    ctx.fill();

    ctx.strokeStyle = color;
    ctx.lineCap = "round";
    // Edge strokes: short, thick, mostly horizontal, overlapping the core edge.
    const passes = 22;
    for (let i = 0; i < passes; i++) {
      const top = i % 2 === 0;
      const t = 0.04 + hash01(seed + i * 3.1) * 0.92;
      const len = sw * (0.08 + hash01(seed + i * 5.7) * 0.18);
      const px = sx + sw * t - len / 2;
      const edge = top ? coreY : coreY + coreH;
      const dir = top ? -1 : 1;
      const reach = sh * (0.04 + hash01(seed + i * 2.3) * 0.12);
      const y0 = edge - dir * sh * 0.04;
      const y1 = edge + dir * reach;
      ctx.globalAlpha = opacity * (0.55 + hash01(seed + i) * 0.4);
      ctx.lineWidth = 2 + hash01(seed + i * 4) * 3;
      ctx.beginPath();
      ctx.moveTo(px, y0);
      ctx.quadraticCurveTo(px + len * 0.5, (y0 + y1) / 2 + (hash01(seed + i * 8) - 0.5) * 3, px + len, y1);
      ctx.stroke();
    }
    // End caps: a couple of short strokes at each end so the tips aren't hard.
    for (const end of [0, 1]) {
      const ex = end === 0 ? sx : sx + sw;
      const dir = end === 0 ? -1 : 1;
      for (let k = 0; k < 3; k++) {
        const ey = coreY + coreH * (0.25 + hash01(seed + end * 10 + k) * 0.5);
        ctx.globalAlpha = opacity * 0.6;
        ctx.lineWidth = 2 + hash01(seed + k) * 2;
        ctx.beginPath();
        ctx.moveTo(ex - dir * sw * 0.04, ey);
        ctx.lineTo(ex + dir * sw * (0.02 + hash01(seed + k * 3) * 0.04), ey + (hash01(seed + k) - 0.5) * 4);
        ctx.stroke();
      }
    }
  } else {
    // brush
    for (let i = 0; i < 5; i++) {
      const jy = (hash01(seed + i * 3) - 0.5) * sh * 0.35;
      const jx = (hash01(seed + i * 7) - 0.5) * spreadX;
      ctx.strokeStyle = color;
      ctx.lineWidth = sh * (0.42 + hash01(seed + i * 11) * 0.28);
      ctx.globalAlpha = opacity * (0.35 + hash01(seed + i) * 0.35);
      ctx.beginPath();
      ctx.moveTo(sx + jx, sy + sh * 0.45 + jy);
      ctx.quadraticCurveTo(sx + sw * 0.45, sy + sh * 0.5 + (hash01(seed + i * 5) - 0.5) * sh * 0.25, sx + sw - jx, sy + sh * 0.42 + (hash01(seed + i * 9) - 0.5) * sh * 0.2);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rad = Math.max(0, Math.min(r, Math.min(w, h) / 2));
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}


type Token = { kind: "text"; text: string } | { kind: "sym"; code: string };
type Piece = { kind: "text"; text: string; width: number } | { kind: "sym"; code: string; width: number };
type VisualLine = { pieces: Piece[]; width: number };

function tokenize(text: string): Token[] {
  const parts = text.split(/(\{[^}]+\})/g);
  return parts
    .filter((p) => p.length > 0)
    .map((p) =>
      p.startsWith("{") && p.endsWith("}") ? { kind: "sym", code: p } : { kind: "text", text: p }
    );
}

function setLetterSpacing(ctx: CanvasRenderingContext2D, px: number) {
  // letterSpacing is widely supported; guard for older engines.
  (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = `${px}px`;
}

function measureTokenWidth(ctx: CanvasRenderingContext2D, token: Token, symSize: number): number {
  if (token.kind === "sym") return symSize;
  return ctx.measureText(token.text).width;
}

/** Split text into visual lines that fit maxW, honoring hard breaks, symbols, wrap mode, and max lines. */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxW: number,
  symSize: number,
  wrapMode: "wrap" | "nowrap" | "ellipsis",
  letterSpacing: number,
  maxLines: number
): VisualLine[] {
  setLetterSpacing(ctx, letterSpacing);
  const limit = maxLines > 0 ? maxLines : Infinity;
  const hard = text.split("\n");
  const out: VisualLine[] = [];
  let truncated = false;

  function pushEllipsis(line: VisualLine) {
    const ell = "…";
    const ew = ctx.measureText(ell).width;
    function lineWidth(pieces: Piece[]): number {
      let w = 0;
      for (let i = 0; i < pieces.length; i++) {
        w += pieces[i].width;
        if (i < pieces.length - 1 && pieces[i].kind === "sym") w += 4;
      }
      return w;
    }
    while (line.pieces.length && lineWidth(line.pieces) + ew > maxW) {
      const last = line.pieces[line.pieces.length - 1];
      if (last.kind === "text" && last.text.length > 1) {
        last.text = last.text.slice(0, -1);
        last.width = ctx.measureText(last.text).width;
      } else {
        line.pieces.pop();
      }
    }
    line.pieces.push({ kind: "text", text: ell, width: ew });
    line.width = lineWidth(line.pieces);
  }

  for (const hardLine of hard) {
    if (out.length >= limit) { truncated = true; break; }
    const tokens = tokenize(hardLine);
    // Flatten text tokens into words (keeping spaces attached to the following word for wrapping).
    const atoms: Token[] = [];
    for (const t of tokens) {
      if (t.kind === "sym") {
        atoms.push(t);
      } else {
        const parts = t.text.split(/(\s+)/);
        for (const p of parts) {
          if (p) atoms.push({ kind: "text", text: p });
        }
      }
    }

    if (wrapMode === "nowrap" || wrapMode === "ellipsis") {
      const pieces: Piece[] = atoms.map((a) => ({ ...a, width: measureTokenWidth(ctx, a, symSize) } as Piece));
      let width = 0;
      for (let i = 0; i < pieces.length; i++) {
        width += pieces[i].width;
        if (i < pieces.length - 1 && pieces[i].kind === "sym") width += 4;
      }
      const line: VisualLine = { pieces, width };
      if (width > maxW && wrapMode === "ellipsis") pushEllipsis(line);
      out.push(line);
      if (out.length >= limit) break;
      continue;
    }

    // wrap
    let cur: Piece[] = [];
    let curW = 0;
    const symGap = 4;

    function flush() {
      if (!cur.length) return;
      let width = 0;
      for (let i = 0; i < cur.length; i++) {
        width += cur[i].width;
        if (i < cur.length - 1 && cur[i].kind === "sym") width += symGap;
      }
      out.push({ pieces: cur, width });
      cur = [];
      curW = 0;
    }

    for (const atom of atoms) {
      if (out.length >= limit) { truncated = true; break; }
      const w = measureTokenWidth(ctx, atom, symSize);
      const isSpace = atom.kind === "text" && /^\s+$/.test(atom.text);
      const extra = cur.length && cur[cur.length - 1].kind === "sym" ? symGap : 0;
      const nextW = curW + extra + w;
      if (!isSpace && cur.length && nextW > maxW) {
        flush();
        if (out.length >= limit) { truncated = true; break; }
      }
      if (isSpace && !cur.length) continue;
      cur.push({ ...atom, width: w } as Piece);
      curW = curW + (cur.length > 1 && cur[cur.length - 2].kind === "sym" ? symGap : 0) + w;
    }
    if (out.length < limit) flush();
  }

  if (truncated && out.length) pushEllipsis(out[out.length - 1]);
  return out;
}

function measureLine(ctx: CanvasRenderingContext2D, line: string, symSize: number): number {
  const tokens = tokenize(line);
  let w = 0;
  for (const t of tokens) {
    if (t.kind === "sym") w += symSize + 4;
    else w += ctx.measureText(t.text).width;
  }
  return w;
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

export type ProxyFields = {
  name: string;
  mana: string;
  typeLine: string;
  rules: string;
  pt: string;
};

function textFor(el: OverlayElement, fields: ProxyFields): string {
  if (el.type === "name") return fields.name || "";
  if (el.type === "typeLine") return fields.typeLine || "";
  if (el.type === "rules") return fields.rules || "";
  if (el.type === "pt") return fields.pt || "";
  if (el.type === "customText") return el.customText || "";
  return "";
}

/** True when an element has nothing to show for this card. Empty elements are not drawn. */
export function elementHasContent(el: OverlayElement, fields: ProxyFields): boolean {
  if (el.type === "mana") return parseManaCost(fields.mana).length > 0;
  return textFor(el, fields).trim().length > 0;
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
    if (!elementHasContent(el, fields)) continue;
    const bg = resolveColor(el.backgroundSource, el.background, el.backgroundOpacity, artColor);
    const border = resolveColor(el.borderSource, el.borderColor, el.borderOpacity, artColor);
    const fill = resolveColor(el.colorSource, el.color, el.colorOpacity, artColor);

    // autoGrow: measure content and expand height using real wrapped lines
    let drawHeight = el.height;
    if (el.autoGrow && el.type !== "mana") {
      const text = textFor(el, fields);
      if (text) {
        const pad = el.padding || 0;
        const fontSize = el.fontSize;
        ctx.font = `${el.fontStyle} ${el.fontWeight} ${fontSize}px ${el.fontFamily || "serif"}`;
        const lineH = Math.round(fontSize * (el.lineHeight || 1.25));
        const symSize = Math.round(fontSize * 0.9);
        const visual = wrapText(ctx, text, Math.max(20, el.width - pad * 2), symSize, el.wrapMode || "wrap", el.letterSpacing || 0, el.maxLines || 0);
        drawHeight = Math.max(el.height, visual.length * lineH + pad * 2);
      }
    }

    // fitWidth elements draw their box after measuring text
    if (!el.fitWidth) {
      if (el.backgroundSource === "art" || (el.background && el.background !== "transparent")) {
        ctx.fillStyle = bg;
        if (el.cornerRadius > 0) {
          roundRect(ctx, el.x, el.y, el.width, drawHeight, el.cornerRadius);
          ctx.fill();
        } else {
          ctx.fillRect(el.x, el.y, el.width, drawHeight);
        }
      }
      if (el.borderWidth > 0) {
        ctx.strokeStyle = border;
        ctx.lineWidth = el.borderWidth;
        if (el.cornerRadius > 0) {
          roundRect(ctx, el.x, el.y, el.width, drawHeight, el.cornerRadius);
          ctx.stroke();
        } else {
          ctx.strokeRect(el.x, el.y, el.width, drawHeight);
        }
      }
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

    const pad = el.padding;
    let fontSize = el.fontSize;
    let drawWidth = el.width;
    let drawX = el.x;

    // Fit width: measure at current size and shrink the box
    ctx.font = `${el.fontStyle} ${el.fontWeight} ${fontSize}px ${el.fontFamily || "serif"}`;
    if (el.fitWidth) {
      const lines = text.split("\n");
      let maxLine = 0;
      for (const line of lines) {
        maxLine = Math.max(maxLine, measureLine(ctx, line, Math.round(fontSize * 0.9)));
      }
      drawWidth = Math.max(40, maxLine + pad * 2);
      if (el.textAlign === "center") drawX = el.x + (el.width - drawWidth) / 2;
      else if (el.textAlign === "right") drawX = el.x + el.width - drawWidth;
    }

    // Fit text: shrink font until the wrapped block fits the height
    if (el.fitText) {
      const maxW = (el.fitWidth ? drawWidth : el.width) - pad * 2;
      const maxH = el.height - pad * 2;
      while (fontSize > 10) {
        ctx.font = `${el.fontStyle} ${el.fontWeight} ${fontSize}px ${el.fontFamily || "serif"}`;
        const symSize = Math.round(fontSize * 0.9);
        const visual = wrapText(ctx, text, Math.max(20, maxW), symSize, el.wrapMode || "wrap", el.letterSpacing || 0, el.maxLines || 0);
        const totalH = visual.length * Math.round(fontSize * (el.lineHeight || 1.25));
        if (totalH <= maxH) break;
        fontSize -= 1;
      }
    }

    if (el.fitWidth) {
      if (el.backgroundSource === "art" || (el.background && el.background !== "transparent")) {
        ctx.fillStyle = bg;
        if (el.cornerRadius > 0) {
          roundRect(ctx, drawX, el.y, drawWidth, el.height, el.cornerRadius);
          ctx.fill();
        } else {
          ctx.fillRect(drawX, el.y, drawWidth, el.height);
        }
      }
      if (el.borderWidth > 0) {
        ctx.strokeStyle = border;
        ctx.lineWidth = el.borderWidth;
        if (el.cornerRadius > 0) {
          roundRect(ctx, drawX, el.y, drawWidth, el.height, el.cornerRadius);
          ctx.stroke();
        } else {
          ctx.strokeRect(drawX, el.y, drawWidth, el.height);
        }
      }
    }

    ctx.fillStyle = fill;
    ctx.font = `${el.fontStyle} ${el.fontWeight} ${fontSize}px ${el.fontFamily || "serif"}`;
    ctx.textBaseline = "top";
    setLetterSpacing(ctx, el.letterSpacing || 0);
    if (el.textOutline && el.textOutlineWidth > 0) {
      ctx.strokeStyle = el.textOutline;
      ctx.lineWidth = el.textOutlineWidth;
      ctx.lineJoin = "round";
    }
    if (el.textShadow) {
      ctx.shadowColor = el.textShadow;
      ctx.shadowBlur = 4;
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 1;
    } else {
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
    }

    const symSize = Math.round(fontSize * 0.9);
    const lineH = Math.round(fontSize * (el.lineHeight || 1.25));
    const innerW = Math.max(20, drawWidth - pad * 2);
    const visual = wrapText(
      ctx,
      text,
      innerW,
      symSize,
      el.wrapMode || "wrap",
      el.letterSpacing || 0,
      el.maxLines || 0
    );
    if (!visual.length) continue;

    const blockH = visual.length * lineH;
    const boxH = el.autoGrow ? Math.max(el.height, blockH + pad * 2) : el.height;
    let ty = el.y + pad;
    if (el.verticalAlign === "middle") ty = el.y + Math.max(pad, (boxH - blockH) / 2);
    else if (el.verticalAlign === "bottom") ty = el.y + boxH - pad - blockH;

    // Preload every symbol used.
    const codes = new Set<string>();
    for (const line of visual) for (const p of line.pieces) if (p.kind === "sym") codes.add(p.code);
    const symImgs = new Map<string, HTMLImageElement>();
    await Promise.all([...codes].map(async (c) => symImgs.set(c, await loadSymbol(c))));

    // Highlighter strokes sit under the text.
    if (el.highlightColor) {
      const prevShadow = ctx.shadowColor;
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      const style = el.highlightStyle || "brush";
      const spreadX = el.highlightSpread || 0;
      const spreadY = el.highlightSpreadY || 0;
      const offX = el.highlightOffsetX || 0;
      const offY = el.highlightOffsetY || 0;
      const mode = el.highlightMode || "line";
      if (mode === "block") {
        let minX = Infinity;
        let maxX = -Infinity;
        visual.forEach((line) => {
          let hx = drawX + pad;
          if (el.textAlign === "center") hx = drawX + (drawWidth - line.width) / 2;
          else if (el.textAlign === "right") hx = drawX + drawWidth - pad - line.width;
          minX = Math.min(minX, hx);
          maxX = Math.max(maxX, hx + line.width);
        });
        drawHighlighter(
          ctx,
          minX + offX,
          ty + offY,
          Math.max(maxX - minX, 12),
          blockH,
          el.highlightColor,
          el.highlightOpacity,
          style,
          spreadX,
          spreadY,
          1
        );
      } else {
        let hy = ty;
        visual.forEach((line, i) => {
          if (hy > el.y + boxH - 4) return;
          let hx = drawX + pad;
          if (el.textAlign === "center") hx = drawX + (drawWidth - line.width) / 2;
          else if (el.textAlign === "right") hx = drawX + drawWidth - pad - line.width;
          drawHighlighter(ctx, hx + offX, hy + offY, Math.max(line.width, 12), lineH, el.highlightColor, el.highlightOpacity, style, spreadX, spreadY, i + 1);
          hy += lineH;
        });
      }
      ctx.shadowColor = prevShadow;
      if (el.textShadow) ctx.shadowBlur = 4;
    }

    for (const line of visual) {
      if (ty > el.y + boxH - 4) break;
      let x = drawX + pad;
      if (el.textAlign === "center") x = drawX + (drawWidth - line.width) / 2;
      else if (el.textAlign === "right") x = drawX + drawWidth - pad - line.width;

      for (let i = 0; i < line.pieces.length; i++) {
        const p = line.pieces[i];
        if (p.kind === "sym") {
          const im = symImgs.get(p.code);
          const sy = ty + Math.max(0, (lineH - symSize) / 2 - 1);
          if (im && im.complete && im.naturalWidth) ctx.drawImage(im, x, sy, symSize, symSize);
          x += p.width;
          if (i < line.pieces.length - 1) x += 4;
        } else {
          if (el.textOutline && el.textOutlineWidth > 0) ctx.strokeText(p.text, x, ty);
          ctx.fillText(p.text, x, ty);
          x += p.width;
        }
      }
      ty += lineH;
    }
    setLetterSpacing(ctx, 0);
  }
}
