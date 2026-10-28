import { useEffect, useRef, useState } from "react";
import { fetchAutocomplete, fetchNamedCard } from "../lib/scryfallApi";
import { isDrivePickerConfigured, pickDriveImage } from "../lib/googleDrivePicker";
import {
  averageColor,
  CARD_H,
  CARD_W,
  loadTemplates,
  renderTemplate,
  saveTemplates,
  type OverlayTemplate,
  type ProxyFields,
} from "../lib/overlayTemplates";
import { loadTemplatesRemote } from "../lib/overlayTemplateService";
import type { ScryfallCard } from "../types/scryfallCard";
import styles from "../pages/LoginPage.module.css";

export function ProxyCreator({
  onSave,
}: {
  onSave: (oracleId: string, name: string, blob: Blob) => Promise<void>;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [card, setCard] = useState<ScryfallCard | null>(null);
  const [fields, setFields] = useState<ProxyFields>({
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
  const [templates, setTemplates] = useState<OverlayTemplate[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [artScale, setArtScale] = useState(1);
  const [artOffset, setArtOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const driveReady = isDrivePickerConfigured();

  useEffect(() => {
    void (async () => {
      const local = loadTemplates();
      const { templates: remote, error } = await loadTemplatesRemote();
      const all = !error && remote.length > 0 ? remote : local;
      if (!error && remote.length > 0) saveTemplates(remote);
      setTemplates(all);
      if (all[0]) setTemplateId(all[0].id);
    })();
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable);
      if (typing) return;
      const step = e.shiftKey ? 10 : 1;
      if (e.key === "ArrowLeft") { e.preventDefault(); setArtOffset((o) => ({ ...o, x: o.x - step })); }
      if (e.key === "ArrowRight") { e.preventDefault(); setArtOffset((o) => ({ ...o, x: o.x + step })); }
      if (e.key === "ArrowUp") { e.preventDefault(); setArtOffset((o) => ({ ...o, y: o.y - step })); }
      if (e.key === "ArrowDown") { e.preventDefault(); setArtOffset((o) => ({ ...o, y: o.y + step })); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const template = templates.find((t) => t.id === templateId) ?? templates[0] ?? null;

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

  async function generateWithPerchance(promptText: string): Promise<string> {
    // Official Image API v1: hidden iframe + postMessage. Returns a permanent URL.
    // Warm-up once so Cloudflare is happy for this origin.
    await new Promise<void>((resolve) => {
      const warm = document.createElement("iframe");
      warm.src = "https://perchance.org";
      warm.style.cssText = "position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;border:0;";
      warm.onload = () => { warm.remove(); resolve(); };
      warm.onerror = () => { warm.remove(); resolve(); };
      document.body.appendChild(warm);
      setTimeout(() => { warm.remove(); resolve(); }, 8000);
    });

    const id = Math.random().toString(36).slice(2);
    const params = new URLSearchParams({
      prompt: promptText,
      format: "json",
      id,
      resolution: "512x768",
    });

    return new Promise<string>((resolve, reject) => {
      const frame = document.createElement("iframe");
      frame.src = `https://perchance.org/perchance-ai-api?${params.toString()}`;
      frame.style.cssText = "position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;border:0;";
      let settled = false;

      function cleanup() {
        window.removeEventListener("message", onMsg);
        frame.remove();
      }
      function finishOk(value: string) {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(value);
      }
      function finishErr(err: Error) {
        if (settled) return;
        settled = true;
        cleanup();
        reject(err);
      }

      function onMsg(e: MessageEvent) {
        const d = e.data as { api?: string; result?: { id?: string; ok?: boolean; url?: string; error?: string } } | null;
        if (!d || d.api !== "perchance-image-api" || !d.result || d.result.id !== id) return;
        if (d.result.ok && d.result.url) finishOk(d.result.url);
        else finishErr(new Error(d.result.error || "Perchance generation failed."));
      }

      window.addEventListener("message", onMsg);
      document.body.appendChild(frame);

      // Hard timeout — Perchance can be slow or challenge the iframe.
      setTimeout(() => finishErr(new Error("Perchance timed out. Try again in a moment.")), 90000);
    });
  }

  async function generate() {
    const p = prompt.trim();
    if (!p) return;
    setBusy(true);
    setError(null);
    try {
      const imageUrl = await generateWithPerchance(p);
      const res = await fetch(imageUrl);
      if (!res.ok) throw new Error(`Could not download result (${res.status}).`);
      const blob = await res.blob();
      setArtFromFile(new File([blob], "generated.png", { type: blob.type || "image/png" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !template) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let cancelled = false;

    async function run(img: HTMLImageElement | null) {
      if (!ctx || cancelled || !template) return;
      await renderTemplate(ctx, template, fields, img, artOffset, artScale, borderColor);
    }

    if (artUrl) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        if (cancelled) return;
        setBorderColor(averageColor(img));
        void run(img);
      };
      img.onerror = () => void run(null);
      img.src = artUrl;
    } else {
      void run(null);
    }
    return () => {
      cancelled = true;
    };
  }, [artUrl, fields, borderColor, artScale, artOffset, template]);

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
        <label className={styles.label}>Overlay template</label>
        <select
          className={styles.input}
          value={templateId}
          onChange={(e) => setTemplateId(e.target.value)}
        >
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

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
            <label className={styles.label}>Or generate (Perchance, in-page)</label>
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
              {busy ? "Generating…" : "Generate with Perchance"}
            </button>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Art position — drag preview to pan. Zoom: {artScale.toFixed(2)}</label>
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
            Overlay comes from the selected template. Drag or use arrow keys to reposition art (Shift = 10px).
          </p>
        </div>
      </div>
    </div>
  );
}
