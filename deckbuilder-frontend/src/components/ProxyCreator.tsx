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

type StylePreset = { id: string; name: string; prefix: string; suffix: string };

const PRESETS_KEY = "deckapp.proxy.stylePresets";
function loadPresets(): StylePreset[] {
  try {
    const raw = localStorage.getItem(PRESETS_KEY);
    return raw ? (JSON.parse(raw) as StylePreset[]) : [];
  } catch { return []; }
}
function savePresets(list: StylePreset[]) {
  localStorage.setItem(PRESETS_KEY, JSON.stringify(list));
}

const COLOR_PALETTE: Record<string, string> = {
  W: "warm gold, ivory and soft cream",
  U: "deep cobalt and ocean teal",
  B: "charcoal, deep violet-black and muted plum",
  R: "ember red, burnt orange and warm gold",
  G: "forest green, moss and earth brown",
  C: "platinum, graphite and void tones, never reading as white",
};

function paletteFromCard(card: { color_identity?: string[]; colors?: string[] } | null): string {
  const colors = card?.color_identity?.length ? card.color_identity : card?.colors ?? [];
  if (!colors.length) return COLOR_PALETTE.C;
  return colors.map((c) => COLOR_PALETTE[c] || c).join(", ");
}

const COSMIC_INK_SUFFIX = `Rendered in the Cosmic Ink style: a vertical 3:4 full-bleed fantasy illustration with no text, letters, card frame or border. Broad cosmic watercolor washes and soft alcohol-ink blooms with deep nebula depth, accented by a few sparse, smooth silver ink veins; no lightning, zigzag crackle, heavy spatter or dense line webs. Palette led by {PALETTE}, with violet only as a small accent. Serious, solemn, mythic tone. The subject is fully in frame with breathing room at the edges, staged in the middle of the image between roughly 13% and 65% of the height and kept within the central width. The top eighth is a calm sky or void wash, and the lower third continues the scene but stays decluttered, low-contrast and low-detail so overlaid text stays legible, never a blank flat fill.`;

const DEFAULT_PRESETS: StylePreset[] = [
  {
    id: "default-cosmic-ink",
    name: "Cosmic Ink",
    prefix: "",
    suffix: COSMIC_INK_SUFFIX,
  },
  {
    id: "default-cosmic-ink-character",
    name: "Cosmic Ink · Character",
    prefix: "",
    suffix: COSMIC_INK_SUFFIX + " The character is fully in frame, head to feet. Clearly adult, coverage pieces only, no nudity or sexual posing.",
  },
  {
    id: "default-cosmic-ink-scene",
    name: "Cosmic Ink · Scene",
    prefix: "",
    suffix: COSMIC_INK_SUFFIX + " Wide establishing view of the place or event, no single dominant figure required.",
  },
];

function withDefaults(list: StylePreset[]): StylePreset[] {
  const ids = new Set(list.map((p) => p.id));
  return [...DEFAULT_PRESETS.filter((d) => !ids.has(d.id)), ...list];
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
  const [presets, setPresets] = useState<StylePreset[]>([]);
  const [activePresetId, setActivePresetId] = useState("");
  const [presetName, setPresetName] = useState("");
  const [presetPrefix, setPresetPrefix] = useState("");
  const [presetSuffix, setPresetSuffix] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<OverlayTemplate[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [artScale, setArtScale] = useState(1);
  const [artOffset, setArtOffset] = useState({ x: 0, y: 0 });
  const [artHistory, setArtHistory] = useState<{ scale: number; offset: { x: number; y: number } }[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const [batchList, setBatchList] = useState("");
  const [batchProgress, setBatchProgress] = useState("");
  const [faceIndex, setFaceIndex] = useState(0);
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const driveReady = isDrivePickerConfigured();

  const RECENT_KEY = "deckapp.proxy.recent";
  function remember(name: string) {
    const next = [name, ...recent.filter((n) => n !== name)].slice(0, 12);
    setRecent(next);
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  }
  useEffect(() => {
    try {
      const raw = localStorage.getItem(RECENT_KEY);
      if (raw) setRecent(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    void (async () => {
      const local = loadTemplates();
      const { templates: remote, error } = await loadTemplatesRemote();
      const all = !error && remote.length > 0 ? remote : local;
      if (!error && remote.length > 0) saveTemplates(remote);
      setTemplates(all);
      if (all[0]) setTemplateId(all[0].id);
      setPresets(withDefaults(loadPresets()));
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
    setFaceIndex(0);
    applyFace(c, 0);
    setPrompt(c.name);
    setArtOffset({ x: 0, y: 0 });
    setArtScale(1);
    setArtHistory([]);
    setQuery("");
    setSuggestions([]);
    remember(c.name);
  }

  function applyFace(c: ScryfallCard, index: number) {
    const faces = (c as ScryfallCard & { card_faces?: Array<{ name?: string; mana_cost?: string; type_line?: string; oracle_text?: string; power?: string; toughness?: string; loyalty?: string; flavor_text?: string; artist?: string }> }).card_faces;
    const face = faces && faces[index] ? faces[index] : null;
    const flavor = face?.flavor_text || (c as ScryfallCard & { flavor_text?: string }).flavor_text || "";
    const artist = face?.artist || (c as ScryfallCard & { artist?: string }).artist || "";
    setFields({
      name: face?.name || c.name,
      mana: face?.mana_cost || c.mana_cost || "",
      typeLine: face?.type_line || c.type_line || "",
      rules: face?.oracle_text || c.oracle_text || "",
      pt: face?.power && face?.toughness ? `${face.power}/${face.toughness}` : face?.loyalty || (c.power && c.toughness ? `${c.power}/${c.toughness}` : c.loyalty || ""),
      flavor,
      artist,
      setSymbol: (c as ScryfallCard & { set?: string }).set?.toUpperCase() || "",
      watermark: (c as ScryfallCard & { watermark?: string }).watermark || "",
      collector: `${(c as ScryfallCard & { collector_number?: string }).collector_number || ""} ${(c as ScryfallCard & { set?: string }).set || ""}`.trim(),
    });
  }

  function setArtFromFile(file: File) {
    const url = URL.createObjectURL(file);
    setArtUrl(url);
    setArtOffset({ x: 0, y: 0 });
    setArtScale(1);
  }

  async function pasteArtFromClipboard() {
    setError(null);
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const type = item.types.find((t) => t.startsWith("image/"));
        if (!type) continue;
        const blob = await item.getType(type);
        setArtFromFile(new File([blob], "pasted.png", { type }));
        return;
      }
      setError("Clipboard has no image.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read clipboard.");
    }
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

  function buildPrompt(userPrompt: string): string {
    const preset = presets.find((x) => x.id === activePresetId);
    const palette = paletteFromCard(card);
    const prefix = (preset?.prefix || "").replaceAll("{PALETTE}", palette).trim();
    const suffix = (preset?.suffix || "").replaceAll("{PALETTE}", palette).trim();
    return [prefix, userPrompt.trim(), suffix].filter(Boolean).join(". ");
  }

  async function generate() {
    const p = buildPrompt(prompt);
    if (!p) return;
    setBusy(true);
    setError(null);
    try {
      // Call the local reverse proxy (must be running on the same machine).
      const proxyUrl = `http://127.0.0.1:8787/generate?prompt=${encodeURIComponent(p)}`;
      const res = await fetch(proxyUrl);
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new Error(`Proxy failed (${res.status}).${detail ? " " + detail.slice(0, 180) : ""}`);
      }
      const blob = await res.blob();
      if (!blob.type.startsWith("image/") && blob.size < 1000) {
        throw new Error("Proxy returned no image. Is the local server running?");
      }
      setArtFromFile(new File([blob], "generated.jpg", { type: blob.type || "image/jpeg" }));
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
    if (drag.current) {
      setArtHistory((h) => [...h.slice(-20), { scale: artScale, offset: artOffset }]);
    }
    drag.current = null;
  }

  function undoArt() {
    const last = artHistory[artHistory.length - 1];
    if (!last) return;
    setArtHistory((h) => h.slice(0, -1));
    setArtScale(last.scale);
    setArtOffset(last.offset);
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
      const safe = (fields.name || card.name).replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "");
      const tpl = templates.find((t) => t.id === templateId)?.name || "template";
      const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
      const named = new File([blob], `${safe}_${tpl}_${stamp}.png`, { type: "image/png" });
      await onSave(card.oracle_id || card.id, fields.name || card.name, named);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  }

  function parseDecklist(raw: string): string[] {
    return raw
      .split(/\r?\n/)
      .map((line) => line.replace(/^\s*\d+\s*[x×]?\s*/i, "").replace(/\s*\(.*$/, "").trim())
      .filter((n) => n && !n.startsWith("//") && !n.startsWith("#"));
  }

  async function runBatch() {
    const names = parseDecklist(batchList);
    if (!names.length) {
      setError("No cards in the list.");
      return;
    }
    setBusy(true);
    setError(null);
    let done = 0;
    for (const name of names) {
      setBatchProgress(`${done + 1}/${names.length}: ${name}`);
      try {
        await loadCard(name);
        // Wait a tick for the canvas to render.
        await new Promise((r) => setTimeout(r, 400));
        if (canvasRef.current && card) {
          const blob = await new Promise<Blob | null>((resolve) =>
            canvasRef.current!.toBlob((b) => resolve(b), "image/png")
          );
          if (blob) {
            const safe = name.replace(/[^a-z0-9]+/gi, "_");
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = `${safe}.png`;
            a.click();
            URL.revokeObjectURL(a.href);
          }
        }
      } catch {
        // continue
      }
      done++;
    }
    setBatchProgress(`Done: ${done} cards`);
    setBusy(false);
  }

  function saveCurrentPreset() {
    const name = presetName.trim();
    if (!name) return;
    const id = activePresetId || crypto.randomUUID();
    const next: StylePreset = { id, name, prefix: presetPrefix, suffix: presetSuffix };
    const list = presets.some((x) => x.id === id)
      ? presets.map((x) => (x.id === id ? next : x))
      : [...presets, next];
    setPresets(list);
    savePresets(list);
    setActivePresetId(id);
  }

  function deletePreset(id: string) {
    const list = presets.filter((x) => x.id !== id);
    setPresets(list);
    savePresets(list);
    if (activePresetId === id) setActivePresetId("");
  }

  function loadPreset(id: string) {
    const p = presets.find((x) => x.id === id);
    if (!p) return;
    setActivePresetId(id);
    setPresetName(p.name);
    setPresetPrefix(p.prefix);
    setPresetSuffix(p.suffix);
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
          <div style={{ marginTop: 4, border: "1px solid #333", borderRadius: 6, overflow: "hidden" }}>
            {suggestions.map((name) => (
              <button
                key={name}
                type="button"
                className={styles.secondaryBtn}
                style={{ display: "block", width: "100%", textAlign: "left", borderRadius: 0, border: "none", borderBottom: "1px solid #333" }}
                onClick={() => void loadCard(name)}
              >
                {name}
              </button>
            ))}
          </div>
        )}
        {recent.length > 0 && (
          <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
            {recent.map((n) => (
              <button key={n} type="button" className={styles.secondaryBtn} style={{ fontSize: "0.75rem", padding: "2px 8px" }} onClick={() => void loadCard(n)}>
                {n}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className={styles.field}>
        <label className={styles.label}>Batch from list</label>
        <textarea
          className={styles.input}
          rows={4}
          value={batchList}
          onChange={(e) => setBatchList(e.target.value)}
          placeholder={"1 Sol Ring\n4 Lightning Bolt\nSerra Ascendant"}
        />
        <div style={{ display: "flex", gap: 8, marginTop: 6, alignItems: "center" }}>
          <button type="button" className={styles.secondaryBtn} disabled={busy || !batchList.trim()} onClick={() => void runBatch()}>
            Process list
          </button>
          {batchProgress && <span style={{ fontSize: "0.8rem", opacity: 0.7 }}>{batchProgress}</span>}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(320px, 1fr) minmax(280px, 360px)", gap: "1.5rem", marginTop: "1rem", alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <section>
            <h3 className={styles.label} style={{ marginBottom: 8 }}>Art source</h3>
            <div className={styles.field}>
              <label className={styles.label}>Upload image</label>
              <input
                className={styles.input}
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) setArtFromFile(f);
                }}
              />
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  disabled={!driveReady}
                  onClick={() => void pickDrive()}
                >
                  Google Drive
                </button>
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  onClick={() => void pasteArtFromClipboard()}
                >
                  Paste clipboard
                </button>
              </div>
            </div>
          </section>

          <section>
            <h3 className={styles.label} style={{ marginBottom: 8 }}>Generate art</h3>
            <div className={styles.field}>
              <label className={styles.label}>Style preset</label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <select
                  className={styles.input}
                  value={activePresetId}
                  onChange={(e) => loadPreset(e.target.value)}
                  style={{ flex: 1, minWidth: 160 }}
                >
                  <option value="">None</option>
                  {presets.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <button type="button" className={styles.secondaryBtn} onClick={() => setShowSettings((v) => !v)}>
                  {showSettings ? "Hide" : "Edit"}
                </button>
              </div>
              {showSettings && (
                <div style={{ marginTop: 10, padding: 10, border: "1px solid #333", borderRadius: 6 }}>
                  <div className={styles.field}>
                    <label className={styles.label}>Preset name</label>
                    <input className={styles.input} value={presetName} onChange={(e) => setPresetName(e.target.value)} placeholder="e.g. Concept art" />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>Prefix</label>
                    <textarea className={styles.input} rows={2} value={presetPrefix} onChange={(e) => setPresetPrefix(e.target.value)} placeholder="magic the gathering card art, " />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>Suffix</label>
                    <textarea className={styles.input} rows={2} value={presetSuffix} onChange={(e) => setPresetSuffix(e.target.value)} placeholder=", detailed fantasy illustration, no text" />
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button type="button" className={styles.secondaryBtn} onClick={saveCurrentPreset} disabled={!presetName.trim()}>
                      Save preset
                    </button>
                    {activePresetId && (
                      <button type="button" className={styles.secondaryBtn} onClick={() => deletePreset(activePresetId)}>
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Prompt (local proxy)</label>
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
                style={{ marginTop: 8 }}
              >
                {busy ? "Generating…" : "Generate"}
              </button>
              {prompt.trim() && (
                <p className={styles.subtitle} style={{ marginTop: 8, whiteSpace: "pre-wrap", fontSize: "0.8rem" }}>
                  Full prompt: {buildPrompt(prompt)}
                </p>
              )}
            </div>
          </section>

          <section>
            <h3 className={styles.label} style={{ marginBottom: 8 }}>Art position</h3>
            <div className={styles.field}>
              <label className={styles.label}>Zoom: {artScale.toFixed(2)}</label>
              <input
                type="range"
                min={0.6}
                max={2.5}
                step={0.05}
                value={artScale}
                onChange={(e) => setArtScale(Number(e.target.value))}
                style={{ width: "100%" }}
              />
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  disabled={!artHistory.length}
                  onClick={undoArt}
                >
                  Undo crop
                </button>
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
              <p className={styles.subtitle} style={{ fontSize: "0.8rem", marginTop: 4 }}>
                Drag the preview or use arrow keys (Shift = 10px).
              </p>
            </div>
          </section>

          <section>
            <h3 className={styles.label} style={{ marginBottom: 8 }}>Card text</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              <div className={styles.field}>
                <label className={styles.label}>Name</label>
                <input
                  className={styles.input}
                  value={fields.name}
                  onChange={(e) => setFields((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Mana</label>
                <input
                  className={styles.input}
                  value={fields.mana}
                  onChange={(e) => setFields((f) => ({ ...f, mana: e.target.value }))}
                  placeholder="{4}"
                />
              </div>
              <div className={styles.field} style={{ gridColumn: "1 / -1" }}>
                <label className={styles.label}>Type line</label>
                <input
                  className={styles.input}
                  value={fields.typeLine}
                  onChange={(e) => setFields((f) => ({ ...f, typeLine: e.target.value }))}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>P/T</label>
                <input
                  className={styles.input}
                  value={fields.pt}
                  onChange={(e) => setFields((f) => ({ ...f, pt: e.target.value }))}
                  placeholder="2/2"
                />
              </div>
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Rules</label>
              <textarea
                className={styles.input}
                rows={5}
                value={fields.rules}
                onChange={(e) => setFields((f) => ({ ...f, rules: e.target.value }))}
              />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              <div className={styles.field}>
                <label className={styles.label}>Flavor</label>
                <input className={styles.input} value={fields.flavor || ""} onChange={(e) => setFields((f) => ({ ...f, flavor: e.target.value }))} />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Artist</label>
                <input className={styles.input} value={fields.artist || ""} onChange={(e) => setFields((f) => ({ ...f, artist: e.target.value }))} />
              </div>
            </div>
            {card && (card as ScryfallCard & { card_faces?: unknown[] }).card_faces && (card as ScryfallCard & { card_faces?: unknown[] }).card_faces!.length > 1 && (
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <span className={styles.label}>Face</span>
                {(card as ScryfallCard & { card_faces?: Array<{ name?: string }> }).card_faces!.map((f, i) => (
                  <button
                    key={i}
                    type="button"
                    className={styles.secondaryBtn}
                    style={{ opacity: faceIndex === i ? 1 : 0.6 }}
                    onClick={() => { setFaceIndex(i); applyFace(card, i); }}
                  >
                    {f.name || `Face ${i + 1}`}
                  </button>
                ))}
              </div>
            )}
            {card && (card as ScryfallCard & { all_parts?: Array<{ component?: string; name?: string }> }).all_parts && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                <span className={styles.label}>Related</span>
                {(card as ScryfallCard & { all_parts?: Array<{ component?: string; name?: string }> }).all_parts!
                  .filter((p) => p.component === "token" || p.component === "meld_result")
                  .map((p) => (
                    <button key={p.name} type="button" className={styles.secondaryBtn} style={{ fontSize: "0.75rem" }} onClick={() => void loadCard(p.name || "")}>
                      {p.name}
                    </button>
                  ))}
              </div>
            )}
          </section>

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

        <div style={{ position: "sticky", top: 16 }}>
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
              display: "block",
            }}
          />
          <p className={styles.subtitle} style={{ fontSize: "0.8rem", marginTop: 8 }}>
            Overlay from the selected template. Drag to reposition art.
          </p>
        </div>
      </div>
    </div>
  );
}

