import { useEffect, useRef, useState } from "react";
import { fetchAutocomplete, fetchNamedCard } from "../lib/scryfallApi";
import { isDrivePickerConfigured, pickDriveImage } from "../lib/googleDrivePicker";
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
  // Lighten a bit so the border reads against dark art
  const lift = (v: number) => Math.min(255, Math.round(v * 0.7 + 80));
  return `rgb(${lift(r)},${lift(g)},${lift(b)})`;
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
  const driveReady = isDrivePickerConfigured();

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
    setQuery("");
    setSuggestions([]);
  }

  function setArtFromFile(file: File) {
    const url = URL.createObjectURL(file);
    setArtUrl(url);
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
      const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(p)}?width=768&height=768&nologo=true&seed=${Date.now()}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Generation failed (${res.status}). Pollinations free tier is rate-limited (~1 per 15s).`);
      const blob = await res.blob();
      setArtFromFile(new File([blob], "generated.jpg", { type: blob.type || "image/jpeg" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed.");
    } finally {
      setBusy(false);
    }
  }

  // Draw whenever art or fields change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    function draw(img: HTMLImageElement | null) {
      ctx.fillStyle = "#1a1a1a";
      ctx.fillRect(0, 0, CARD_W, CARD_H);

      // Art window
      const artX = 40;
      const artY = 70;
      const artW = CARD_W - 80;
      const artH = 520;
      if (img) {
        // Cover-fit
        const scale = Math.max(artW / img.width, artH / img.height);
        const dw = img.width * scale;
        const dh = img.height * scale;
        const dx = artX + (artW - dw) / 2;
        const dy = artY + (artH - dh) / 2;
        ctx.save();
        ctx.beginPath();
        ctx.rect(artX, artY, artW, artH);
        ctx.clip();
        ctx.drawImage(img, dx, dy, dw, dh);
        ctx.restore();
      } else {
        ctx.fillStyle = "#2a2a2a";
        ctx.fillRect(artX, artY, artW, artH);
      }

      // Outer frame
      ctx.strokeStyle = "#c8c8c8";
      ctx.lineWidth = 8;
      ctx.strokeRect(16, 16, CARD_W - 32, CARD_H - 32);

      // Name plate
      ctx.fillStyle = "rgba(20,20,20,0.85)";
      ctx.fillRect(36, 28, CARD_W - 72, 38);
      ctx.fillStyle = "#f0f0f0";
      ctx.font = "bold 22px serif";
      ctx.fillText(fields.name || "Card name", 48, 54);
      ctx.font = "18px sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(fields.mana || "", CARD_W - 48, 54);
      ctx.textAlign = "left";

      // Type line
      ctx.fillStyle = "rgba(20,20,20,0.85)";
      ctx.fillRect(36, artY + artH + 8, CARD_W - 72, 32);
      ctx.fillStyle = "#f0f0f0";
      ctx.font = "italic 16px serif";
      ctx.fillText(fields.typeLine || "Type line", 48, artY + artH + 30);

      // Rules box with average-color border
      const rulesY = artY + artH + 48;
      const rulesH = 280;
      ctx.fillStyle = "rgba(245,245,245,0.92)";
      ctx.fillRect(36, rulesY, CARD_W - 72, rulesH);
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 6;
      ctx.strokeRect(36, rulesY, CARD_W - 72, rulesH);

      ctx.fillStyle = "#111";
      ctx.font = "16px serif";
      const lines = (fields.rules || "").split("\n");
      let ty = rulesY + 28;
      for (const line of lines) {
        // simple wrap
        const words = line.split(" ");
        let current = "";
        for (const w of words) {
          const test = current ? current + " " + w : w;
          if (ctx.measureText(test).width > CARD_W - 100) {
            ctx.fillText(current, 52, ty);
            ty += 22;
            current = w;
          } else {
            current = test;
          }
        }
        if (current) {
          ctx.fillText(current, 52, ty);
          ty += 22;
        }
        if (ty > rulesY + rulesH - 20) break;
      }

      // P/T
      if (fields.pt) {
        ctx.fillStyle = "rgba(20,20,20,0.9)";
        ctx.fillRect(CARD_W - 140, CARD_H - 90, 100, 40);
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 3;
        ctx.strokeRect(CARD_W - 140, CARD_H - 90, 100, 40);
        ctx.fillStyle = "#fff";
        ctx.font = "bold 20px serif";
        ctx.textAlign = "center";
        ctx.fillText(fields.pt, CARD_W - 90, CARD_H - 64);
        ctx.textAlign = "left";
      }
    }

    if (artUrl) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        setBorderColor(averageColor(img));
        draw(img);
      };
      img.onerror = () => draw(null);
      img.src = artUrl;
    } else {
      draw(null);
    }
  }, [artUrl, fields, borderColor]);

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
              Uses Pollinations free tier (rate-limited). No download/upload step.
            </p>
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
            style={{ width: "100%", maxWidth: 360, height: "auto", borderRadius: 8, background: "#111" }}
          />
          <p className={styles.subtitle} style={{ fontSize: "0.85rem" }}>
            Rules box border uses the average color of the art.
          </p>
        </div>
      </div>
    </div>
  );
}
