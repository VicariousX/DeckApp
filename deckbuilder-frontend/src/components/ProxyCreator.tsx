import { useEffect, useRef, useState } from "react";
import { fetchAutocomplete, fetchNamedCard } from "../lib/scryfallApi";
import { isDrivePickerConfigured, pickDriveImage } from "../lib/googleDrivePicker";
import { parseManaCost, symbolToSvgUri } from "../utils/symbols";
import type { ScryfallCard } from "../types/scryfallCard";
import styles from "../pages/LoginPage.module.css";

type Fields = {
  name: string;
  mana: string;
  typeLine: string;
  rules: string;
  pt: string;
};

const CARD_W = 750;
const CARD_H = 1050;
const FONT_KEY = "deckapp.proxy.fontSize";

function averageColor(img: HTMLImageElement): string {
  const c = document.createElement("canvas");
  c.width = 32;
  c.height = 32;
  const ctx = c.getContext("2d");
  if (!ctx) return "#3a3a3a";
  ctx.drawImage(img, 0, 0, 32, 32);
  const data = ctx.getImageData(0, 0, 32, 32).data;
  let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i < data.length; i += 4) {
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
    n++;
  }
  r = Math.round(r / n);
  g = Math.round(g / n);
  b = Math.round(b / n);
  const lift = (v: number) => Math.min(255, Math.round(v * 0.65 + 90));
  return `rgb(${lift(r)},${lift(g)},${lift(b)})`;
}

const symbolCache = new Map<string, HTMLImageElement>();
function loadSymbol(code: string): Promise<HTMLImageElement> {
  const existing = symbolCache.get(code);
  if (existing && existing.complete) return Promise.resolve(existing);
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      symbolCache.set(code, img);
      resolve(img);
    };
    img.onerror = () => resolve(img); // draw nothing on miss
    img.src = symbolToSvgUri(code);
  });
}

type Token = { kind: "text"; text: string } | { kind: "sym"; code: string };

function tokenize(text: string): Token[] {
  const parts = text.split(/(\{[^}]+\})/g);
  return parts
    .filter((p) => p.length > 0)
    .map((p) =>
      p.startsWith("{") && p.endsWith("}")
        ? { kind: "sym", code: p }
        : { kind: "text", text: p }
    );
}

export function ProxyCreator({
  onSave,
}: {
  onSave: (oracleId: string, name: string, blob: Blob) => Promise<void>;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [card, setCard] = useState<ScryfallCard | null>(null);
  const [fields, setFields] = useState<Fields>({
    name: "",
    mana: "",
    typeLine: "",
    rules: "",
    pt: "",
  });
  const [artUrl, setArtUrl] = useState<string | null>(null);
  const [borderColor, setBorderColor] = useState("#5a5a5a");
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fontSize, setFontSize] = useState(() => {
    const n = Number(localStorage.getItem(FONT_KEY));
    return Number.isFinite(n) && n >= 18 && n <= 48 ? n : 28;
  });
  const [artScale, setArtScale] = useState(1);
  const [artOffset, setArtOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const driveReady = isDrivePickerConfigured();

  useEffect(() => {
    localStorage.setItem(FONT_KEY, String(fontSize));
  }, [fontSize]);

  useEffect(() => {
    const name = query.trim();
    if (name.length < 2) {
      setSuggestions([]);
      return;
    }
    const t = window.setTimeout(() => {
      void fetchAutocomplete(name).then(({ names }) => setSuggestions(names.slice(0, 8)));
    }, 180);
    return () => window.clearTimeout(t);
  }, [query]);

  async function loadCard(name: string) {
    setError(null);
    const { card: c, error: err } = await fetchNamedCard(name);
    if (err || !c) {
      setError(err ?? "Card not found.");
      return;
    }
    setCard(c);
    setFields({
      name: c.name,
      mana: c.mana_cost || "",
      typeLine: c.type_line || "",
      rules: c.oracle_text || "",
      pt: c.power && c.toughness ? `${c.power}/${c.toughness}` : c.loyalty || "",
    });
    setPrompt(`${c.name}, magic the gathering card art, detailed fantasy illustration`);
    setArtOffset({ x: 0, y: 0 });
    setArtScale(1);
    setQuery("");
    setSuggestions([]);
  }

  function setArtFromFile(file: File) {
    const url = URL.createObjectURL(file);
    setArtUrl(url);
    setArtOffset({ x: 0, y: 0 });
    setArtScale(1);
  }

  async function pickDrive() {
    setError(null);
    try {
      const file = await pickDriveImage();
      if (file) setArtFromFile(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Drive picker failed.");
    }
  }

  async function generate() {
    const p = prompt.trim();
    if (!p) return;
    setBusy(true);
    setError(null);
    try {
      const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(p)}?width=1024&height=1400&nologo=true&seed=${Date.now()}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Generation failed (${res.status}). Free tier is rate-limited (~1 per 15s).`);
      const blob = await res.blob();
      setArtFromFile(new File([blob], "generated.jpg", { type: blob.type || "image/jpeg" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed.");
    } finally {
      setBusy(false);
    }
  }

  // Draw
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let cancelled = false;

    async function draw(img: HTMLImageElement | null) {
      if (!ctx || cancelled) return;
      ctx.fillStyle = "#111";
      ctx.fillRect(0, 0, CARD_W, CARD_H);

      // Full-bleed art
      if (img) {
        const scale = Math.max(CARD_W / img.width, CARD_H / img.height) * artScale;
        const dw = img.width * scale;
        const dh = img.height * scale;
        const dx = (CARD_W - dw) / 2 + artOffset.x;
        const dy = (CARD_H - dh) / 2 + artOffset.y;
        ctx.drawImage(img, dx, dy, dw, dh);
      }

      // Thin outer edge only (full art)
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.lineWidth = 3;
      ctx.strokeRect(8, 8, CARD_W - 16, CARD_H - 16);

      const nameSize = fontSize + 4;
      const bodySize = fontSize;
      const symSize = Math.round(fontSize * 0.9);

      // Name bar
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(24, 20, CARD_W - 48, nameSize + 18);
      ctx.fillStyle = "#fff";
      ctx.font = `bold ${nameSize}px serif`;
      ctx.textBaseline = "middle";
      ctx.fillText(fields.name || "Card name", 40, 20 + (nameSize + 18) / 2);

      // Mana symbols on the right of the name bar
      const manaSyms = parseManaCost(fields.mana);
      if (manaSyms.length) {
        const imgs = await Promise.all(manaSyms.map((s) => loadSymbol(s)));
        if (cancelled) return;
        let mx = CARD_W - 40;
        for (let i = imgs.length - 1; i >= 0; i--) {
          const im = imgs[i];
          if (im.complete && im.naturalWidth) {
            mx -= symSize + 4;
            ctx.drawImage(im, mx, 20 + (nameSize + 18 - symSize) / 2, symSize, symSize);
          }
        }
      }

      // Type line
      const typeY = 20 + nameSize + 28;
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fillRect(24, typeY, CARD_W - 48, bodySize + 12);
      ctx.fillStyle = "#fff";
      ctx.font = `italic ${bodySize}px serif`;
      ctx.fillText(fields.typeLine || "Type line", 40, typeY + (bodySize + 12) / 2);

      // Rules box near bottom
      const rulesH = 260;
      const rulesY = CARD_H - rulesH - 40;
      ctx.fillStyle = "rgba(245,245,245,0.82)";
      ctx.fillRect(28, rulesY, CARD_W - 56, rulesH);
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 5;
      ctx.strokeRect(28, rulesY, CARD_W - 56, rulesH);

      // Rules text with symbols
      ctx.fillStyle = "#111";
      ctx.font = `${bodySize}px serif`;
      ctx.textBaseline = "top";
      let ty = rulesY + 16;
      const maxW = CARD_W - 80;
      const lines = (fields.rules || "").split("\n");
      for (const line of lines) {
        const tokens = tokenize(line);
        // Preload symbols for this line
        const symImgs = new Map<string, HTMLImageElement>();
        for (const t of tokens) {
          if (t.kind === "sym") symImgs.set(t.code, await loadSymbol(t.code));
        }
        if (cancelled) return;
        // Wrap
        let x = 44;
        for (const t of tokens) {
          if (t.kind === "sym") {
            if (x + symSize > 44 + maxW) {
              x = 44;
              ty += bodySize + 6;
            }
            const im = symImgs.get(t.code);
            if (im && im.complete && im.naturalWidth) {
              ctx.drawImage(im, x, ty, symSize, symSize);
            }
            x += symSize + 4;
          } else {
            const words = t.text.split(/(\s+)/);
            for (const w of words) {
              const wW = ctx.measureText(w).width;
              if (x + wW > 44 + maxW && w.trim()) {
                x = 44;
                ty += bodySize + 6;
              }
              ctx.fillText(w, x, ty);
              x += wW;
            }
          }
          if (ty > rulesY + rulesH - bodySize) break;
        }
        ty += bodySize + 8;
        if (ty > rulesY + rulesH - 8) break;
      }

      // P/T
      if (fields.pt) {
        ctx.fillStyle = "rgba(0,0,0,0.7)";
        ctx.fillRect(CARD_W - 150, CARD_H - 80, 110, 46);
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 3;
        ctx.strokeRect(CARD_W - 150, CARD_H - 80, 110, 46);
        ctx.fillStyle = "#fff";
        ctx.font = `bold ${bodySize + 2}px serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(fields.pt, CARD_W - 95, CARD_H - 57);
        ctx.textAlign = "left";
      }
    }

    if (artUrl) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        if (!cancelled) {
          setBorderColor(averageColor(img));
          void draw(img);
        }
      };
      img.onerror = () => void draw(null);
      img.src = artUrl;
    } else {
      void draw(null);
    }

    return () => {
      cancelled = true;
    };
  }, [artUrl, fields, borderColor, fontSize, artScale, artOffset]);

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const scaleX = CARD_W / rect.width;
    const scaleY = CARD_H / rect.height;
    drag.current = {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
      ox: artOffset.x,
      oy: artOffset.y,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drag.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const scaleX = CARD_W / rect.width;
    const scaleY = CARD_H / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    setArtOffset({
      x: drag.current.ox + (x - drag.current.x),
      y: drag.current.oy + (y - drag.current.y),
    });
  }
  function onPointerUp() {
    drag.current = null;
  }

  async function save() {
    if (!card || !canvasRef.current) return;
    setBusy(true);
    setError(null);
    try {
      const blob = await new Promise<Blob | null>((resolve) =>
        canvasRef.current!.toBlob((b) => resolve(b), "image/png")
      );
      if (!blob) throw new Error("Could not export canvas.");
      await onSave(card.oracle_id || card.id, fields.name || card.name, blob);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className={styles.field}>
        <label className={styles.label}>Load card</label>
        <input
          className={styles.input}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search Scryfall…"
          autoComplete="off"
        />
        {suggestions.length > 0 && (
          <div>
            {suggestions.map((name) => (
              <button
                key={name}
                type="button"
                className={styles.secondaryBtn}
                onClick={() => void loadCard(name)}
              >
                {name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginTop: "1rem" }}>
        <div>
          <div className={styles.field}>
            <label className={styles.label}>Art — upload</label>
            <input
              className={styles.input}
              type="file"
              accept="image/*"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) setArtFromFile(f);
              }}
            />
            <button
              type="button"
              className={styles.secondaryBtn}
              disabled={!driveReady}
              onClick={() => void pickDrive()}
            >
              Pick from Google Drive
            </button>
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Or generate (free, in-page)</label>
            <textarea
              className={styles.input}
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe the art…"
            />
            <button
              type="button"
              className={styles.secondaryBtn}
              disabled={busy || !prompt.trim()}
              onClick={() => void generate()}
            >
              {busy ? "Generating…" : "Generate art"}
            </button>
            <p className={styles.subtitle} style={{ fontSize: "0.85rem" }}>
              Real generation via Pollinations free tier. Not a placeholder.
            </p>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Art position</label>
            <p className={styles.subtitle} style={{ fontSize: "0.85rem" }}>
              Drag the preview to pan. Zoom to crop.
            </p>
            <label className={styles.label}>Zoom: {artScale.toFixed(2)}</label>
            <input
              type="range"
              min={0.6}
              max={2.5}
              step={0.05}
              value={artScale}
              onChange={(e) => setArtScale(Number(e.target.value))}
            />
            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={() => {
                setArtOffset({ x: 0, y: 0 });
                setArtScale(1);
              }}
            >
              Reset crop
            </button>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Font size (saved for all proxies): {fontSize}px</label>
            <input
              type="range"
              min={18}
              max={48}
              step={1}
              value={fontSize}
              onChange={(e) => setFontSize(Number(e.target.value))}
            />
          </div>

          {(["name", "mana", "typeLine", "pt"] as const).map((key) => (
            <div key={key} className={styles.field}>
              <label className={styles.label}>{key}</label>
              <input
                className={styles.input}
                value={fields[key]}
                onChange={(e) => setFields((f) => ({ ...f, [key]: e.target.value }))}
              />
            </div>
          ))}
          <div className={styles.field}>
            <label className={styles.label}>rules</label>
            <textarea
              className={styles.input}
              rows={5}
              value={fields.rules}
              onChange={(e) => setFields((f) => ({ ...f, rules: e.target.value }))}
            />
          </div>
          <button
            type="button"
            className={styles.primaryBtn}
            disabled={busy || !card || !artUrl}
            onClick={() => void save()}
          >
            {busy ? "Saving…" : "Save to proxy set"}
          </button>
          {error && <p className={styles.subtitle} style={{ color: "var(--danger, #c44)" }}>{error}</p>}
        </div>
        <div>
          <canvas
            ref={canvasRef}
            width={CARD_W}
            height={CARD_H}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            style={{
              width: "100%",
              maxWidth: 360,
              height: "auto",
              borderRadius: 8,
              background: "#111",
              touchAction: "none",
              cursor: "grab",
            }}
          />
          <p className={styles.subtitle} style={{ fontSize: "0.85rem" }}>
            Full-art layout. Drag to reposition. Rules border uses the average color of the art.
          </p>
        </div>
      </div>
    </div>
  );
}
