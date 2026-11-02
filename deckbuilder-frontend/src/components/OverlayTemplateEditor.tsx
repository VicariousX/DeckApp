import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import styles from "../pages/LoginPage.module.css";
import {
  averageColor,
  CARD_H,
  CARD_W,
  deleteTemplate,
  loadTemplates,
  newElement,
  renderTemplate,
  resolveColor,
  saveTemplates,
  upsertTemplate,
  type ColorSource,
  type OverlayElement,
  type OverlayElementType,
  type OverlayTemplate,
  type ProxyFields,
} from "../lib/overlayTemplates";
import { deleteTemplateRemote, loadTemplatesRemote, upsertTemplateRemote } from "../lib/overlayTemplateService";
import { fetchAutocomplete, fetchNamedCard } from "../lib/scryfallApi";

const PREVIEW_W = 420;
const SCALE = PREVIEW_W / CARD_W;
const GRID = 25;
const SNAP = 8;
const TYPES: OverlayElementType[] = ["name", "mana", "typeLine", "rules", "pt", "customText"];

export function OverlayTemplateEditor() {
  const [templates, setTemplates] = useState<OverlayTemplate[]>([]);
  const [currentId, setCurrentId] = useState("");
  const [name, setName] = useState("");
  const [elements, setElements] = useState<OverlayElement[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [showGrid, setShowGrid] = useState(true);
  const [snap, setSnap] = useState(true);
  const [showSample, setShowSample] = useState(false);
  const [sampleUrl, setSampleUrl] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [previewFields, setPreviewFields] = useState<ProxyFields>({ name: "", mana: "", typeLine: "", rules: "", pt: "" });
  const [previewCardName, setPreviewCardName] = useState("");
  const [view, setView] = useState<"edit" | "preview">("edit");
  const previewCanvas = useRef<HTMLCanvasElement | null>(null);
  const drag = useRef<{
    id: string;
    mode: "move" | "resize";
    sx: number;
    sy: number;
    ox: number;
    oy: number;
    ow: number;
    oh: number;
  } | null>(null);
  const history = useRef<{ past: OverlayElement[][]; future: OverlayElement[][] }>({ past: [], future: [] });
  const elementsRef = useRef<OverlayElement[]>([]);
  elementsRef.current = elements;

  useEffect(() => {
    void (async () => {
      const local = loadTemplates();
      const { templates: remote, error } = await loadTemplatesRemote();
      const all = !error && remote.length > 0 ? remote : local;
      if (!error && remote.length > 0) saveTemplates(remote);
      setTemplates(all);
      if (all[0]) {
        setCurrentId(all[0].id);
        setName(all[0].name);
        setElements(all[0].elements);
      }
    })();
  }, []);

  useEffect(() => {
    const nameQ = query.trim();
    if (nameQ.length < 2) {
      setSuggestions([]);
      return;
    }
    const t = window.setTimeout(() => {
      void fetchAutocomplete(nameQ).then(({ names }) => setSuggestions(names.slice(0, 8)));
    }, 180);
    return () => window.clearTimeout(t);
  }, [query]);

  async function loadCard(cardName: string) {
    const { card, error } = await fetchNamedCard(cardName);
    if (error || !card) {
      setInfo(error ?? "Card not found.");
      return;
    }
    setPreviewFields({
      name: card.name,
      mana: card.mana_cost || "",
      typeLine: card.type_line || "",
      rules: card.oracle_text || "",
      pt: card.power && card.toughness ? `${card.power}/${card.toughness}` : card.loyalty || "",
    });
    setPreviewCardName(card.name);
    setQuery("");
    setSuggestions([]);
    setView("preview");
    setInfo(`Previewing ${card.name}.`);
  }

  async function pasteSample() {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const type = item.types.find((t) => t.startsWith("image/"));
        if (!type) continue;
        const blob = await item.getType(type);
        setSampleUrl(URL.createObjectURL(blob));
        setShowSample(true);
        setView("preview");
        setInfo("Pasted sample art.");
        return;
      }
      setInfo("Clipboard has no image.");
    } catch (err) {
      setInfo(err instanceof Error ? err.message : "Could not read clipboard.");
    }
  }

  useEffect(() => {
    const canvas = previewCanvas.current;
    if (!canvas || view !== "preview") return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let cancelled = false;
    const template: OverlayTemplate = {
      id: currentId || "preview",
      name: name || "Preview",
      elements,
      updatedAt: new Date().toISOString(),
    };
    async function run(img: HTMLImageElement | null) {
      if (!ctx || cancelled) return;
      const artColor = img ? averageColor(img) : "#5a5a5a";
      await renderTemplate(ctx, template, previewFields, img, { x: 0, y: 0 }, 1, artColor);
    }
    if (sampleUrl && showSample) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => { if (!cancelled) void run(img); };
      img.onerror = () => void run(null);
      img.src = sampleUrl;
    } else {
      void run(null);
    }
    return () => { cancelled = true; };
  }, [view, elements, previewFields, sampleUrl, showSample, currentId, name]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        save();
        return;
      }
      if (typing) return;
      if (!selected) return;
      const step = e.shiftKey ? 10 : 1;
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        pushHistory();
        setElements((prev) => prev.filter((el) => el.id !== selected));
        setSelected(null);
        return;
      }
      if (e.key === "Escape") {
        setSelected(null);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey))) {
        e.preventDefault();
        redo();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "d") {
        e.preventDefault();
        pushHistory();
        const el = elements.find((x) => x.id === selected);
        if (!el) return;
        const copy = { ...el, id: Math.random().toString(36).slice(2, 10), x: el.x + 16, y: el.y + 16, zIndex: el.zIndex + 1 };
        setElements((prev) => [...prev, copy]);
        setSelected(copy.id);
        return;
      }
      if (e.key === "ArrowLeft") { e.preventDefault(); pushHistory(); updateSelected({ x: Math.max(0, (elements.find(x => x.id === selected)?.x ?? 0) - step) }); }
      if (e.key === "ArrowRight") { e.preventDefault(); pushHistory(); updateSelected({ x: (elements.find(x => x.id === selected)?.x ?? 0) + step }); }
      if (e.key === "ArrowUp") { e.preventDefault(); pushHistory(); updateSelected({ y: Math.max(0, (elements.find(x => x.id === selected)?.y ?? 0) - step) }); }
      if (e.key === "ArrowDown") { e.preventDefault(); pushHistory(); updateSelected({ y: (elements.find(x => x.id === selected)?.y ?? 0) + step }); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const ordered = useMemo(
    () => [...elements].sort((a, b) => b.zIndex - a.zIndex),
    [elements]
  );
  const sel = elements.find((e) => e.id === selected) ?? null;

  function load(id: string) {
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    history.current = { past: [], future: [] };
    setCurrentId(t.id);
    setName(t.name);
    setElements(t.elements);
    setSelected(null);
    setInfo(null);
  }

  async function save() {
    const id = currentId || Math.random().toString(36).slice(2, 10);
    const template: OverlayTemplate = {
      id,
      name: name.trim() || "Untitled",
      elements,
      updatedAt: new Date().toISOString(),
    };
    const all = upsertTemplate(template);
    setTemplates(all);
    setCurrentId(id);
    const { error } = await upsertTemplateRemote(template);
    setInfo(error ? `Saved locally. Cloud: ${error}` : `Saved “${template.name}”.`);
  }

  async function saveAs() {
    const id = Math.random().toString(36).slice(2, 10);
    const template: OverlayTemplate = {
      id,
      name: (name.trim() || "Untitled") + " copy",
      elements: elements.map((e) => ({ ...e, id: Math.random().toString(36).slice(2, 10) })),
      updatedAt: new Date().toISOString(),
    };
    const all = upsertTemplate(template);
    setTemplates(all);
    setCurrentId(id);
    setName(template.name);
    const { error } = await upsertTemplateRemote(template);
    setInfo(error ? `Saved locally. Cloud: ${error}` : `Saved as “${template.name}”.`);
  }

  async function remove() {
    if (!currentId) return;
    const id = currentId;
    const all = deleteTemplate(id);
    setTemplates(all);
    if (all[0]) {
      setCurrentId(all[0].id);
      setName(all[0].name);
      setElements(all[0].elements);
    }
    const { error } = await deleteTemplateRemote(id);
    setInfo(error ? `Deleted locally. Cloud: ${error}` : "Template deleted.");
  }

  function add(type: OverlayElementType) {
    pushHistory();
    const z = elements.reduce((m, e) => Math.max(m, e.zIndex), 0) + 1;
    const el = newElement(type, z);
    setElements((prev) => [...prev, el]);
    setSelected(el.id);
  }

  function pushHistory() {
    history.current.past.push(elementsRef.current.map((el) => ({ ...el })));
    if (history.current.past.length > 50) history.current.past.shift();
    history.current.future = [];
  }

  function undo() {
    const prev = history.current.past.pop();
    if (!prev) return;
    history.current.future.push(elementsRef.current.map((el) => ({ ...el })));
    setElements(prev);
    setInfo("Undo");
  }

  function redo() {
    const next = history.current.future.pop();
    if (!next) return;
    history.current.past.push(elementsRef.current.map((el) => ({ ...el })));
    setElements(next);
    setInfo("Redo");
  }

  function updateSelected(patch: Partial<OverlayElement>) {
    if (!selected) return;
    setElements((prev) => prev.map((e) => (e.id === selected ? { ...e, ...patch } : e)));
  }

  function setZ(id: string, z: number) {
    setElements((prev) => prev.map((e) => (e.id === id ? { ...e, zIndex: z } : e)));
  }

  function bring(id: string, dir: "front" | "back" | "forward" | "backward") {
    pushHistory();
    const max = elements.reduce((m, e) => Math.max(m, e.zIndex), 0);
    const min = elements.reduce((m, e) => Math.min(m, e.zIndex), 0);
    const el = elements.find((e) => e.id === id);
    if (!el) return;
    if (dir === "front") setZ(id, max + 1);
    else if (dir === "back") setZ(id, min - 1);
    else if (dir === "forward") setZ(id, el.zIndex + 1);
    else setZ(id, el.zIndex - 1);
  }

  function align(axis: "left" | "center" | "right" | "top" | "middle" | "bottom") {
    if (!sel) return;
    pushHistory();
    const patch: Partial<OverlayElement> = {};
    if (axis === "left") patch.x = 0;
    if (axis === "center") patch.x = (CARD_W - sel.width) / 2;
    if (axis === "right") patch.x = CARD_W - sel.width;
    if (axis === "top") patch.y = 0;
    if (axis === "middle") patch.y = (CARD_H - sel.height) / 2;
    if (axis === "bottom") patch.y = CARD_H - sel.height;
    updateSelected(patch);
  }

  function snapValue(v: number, others: number[]): number {
    if (!snap) return v;
    const targets = [0, CARD_W / 2, CARD_H / 2, CARD_W, CARD_H, ...others];
    for (let g = 0; g <= CARD_W; g += GRID) targets.push(g);
    for (let g = 0; g <= CARD_H; g += GRID) targets.push(g);
    let best = v;
    let bestD = SNAP + 1;
    for (const t of targets) {
      const d = Math.abs(v - t);
      if (d < bestD) {
        bestD = d;
        best = t;
      }
    }
    return bestD <= SNAP ? best : v;
  }

  function onPointerDown(e: React.PointerEvent, id: string, mode: "move" | "resize") {
    e.stopPropagation();
    const el = elements.find((x) => x.id === id);
    if (!el) return;
    pushHistory();
    setSelected(id);
    drag.current = {
      id,
      mode,
      sx: e.clientX,
      sy: e.clientY,
      ox: el.x,
      oy: el.y,
      ow: el.width,
      oh: el.height,
    };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current) return;
    const dx = (e.clientX - drag.current.sx) / SCALE;
    const dy = (e.clientY - drag.current.sy) / SCALE;
    const { id, mode, ox, oy, ow, oh } = drag.current;
    const others = elements.filter((el) => el.id !== id);
    const xs = others.flatMap((el) => [el.x, el.x + el.width, el.x + el.width / 2]);
    const ys = others.flatMap((el) => [el.y, el.y + el.height, el.y + el.height / 2]);

    setElements((prev) =>
      prev.map((el) => {
        if (el.id !== id) return el;
        if (mode === "move") {
          let x = ox + dx;
          let y = oy + dy;
          x = snapValue(x, xs);
          y = snapValue(y, ys);
          // also snap right/bottom edges
          const right = snapValue(x + el.width, xs);
          if (Math.abs(right - (x + el.width)) > 0.5) x = right - el.width;
          const bottom = snapValue(y + el.height, ys);
          if (Math.abs(bottom - (y + el.height)) > 0.5) y = bottom - el.height;
          return {
            ...el,
            x: Math.max(0, Math.min(CARD_W - 20, x)),
            y: Math.max(0, Math.min(CARD_H - 20, y)),
          };
        }
        const nw = Math.max(40, ow + dx);
          const nh = Math.max(24, oh + dy);
          return {
            ...el,
            width: snap ? snapValue(el.x + nw, xs) - el.x : nw,
            height: Math.max(24, nh),
          };
      })
    );
  }

  function onPointerUp() {
    drag.current = null;
  }

  const artPreview = "#6a8a7a";
  const btn: CSSProperties = {
    width: "auto",
    display: "inline-block",
    padding: "0.4rem 0.75rem",
    fontSize: "0.82rem",
    margin: 0,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", width: "100%" }}>
      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "0.4rem",
          alignItems: "center",
          padding: "0.5rem 0.6rem",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 8,
          background: "rgba(255,255,255,0.02)",
        }}
      >
        <select className={styles.input} value={currentId} onChange={(e) => load(e.target.value)} style={{ maxWidth: 200, margin: 0 }}>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Template name" style={{ maxWidth: 180, margin: 0 }} />
        <div style={{ display: "flex", gap: 4 }}>
          <button type="button" className={styles.secondaryBtn} style={btn} onClick={undo}>Undo</button>
          <button type="button" className={styles.secondaryBtn} style={btn} onClick={redo}>Redo</button>
          <button type="button" className={styles.primaryBtn} style={btn} onClick={() => void save()}>Save</button>
          <button type="button" className={styles.secondaryBtn} style={btn} onClick={() => void saveAs()}>Save as</button>
          <button type="button" className={styles.secondaryBtn} style={btn} onClick={() => void remove()}>Delete</button>
        </div>
        <div style={{ display: "flex", gap: 4, alignItems: "center", position: "relative" }}>
          <input
            className={styles.input}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Load card…"
            autoComplete="off"
            style={{ maxWidth: 180, margin: 0 }}
          />
          {suggestions.length > 0 && (
            <div style={{ position: "absolute", top: "100%", left: 0, zIndex: 5, background: "#1a1a1a", border: "1px solid #333", borderRadius: 6, minWidth: 180 }}>
              {suggestions.map((s) => (
                <button key={s} type="button" className={styles.secondaryBtn} style={{ ...btn, display: "block", width: "100%", textAlign: "left", borderRadius: 0 }} onClick={() => void loadCard(s)}>
                  {s}
                </button>
              ))}
            </div>
          )}
          {previewCardName && <span style={{ fontSize: "0.75rem", opacity: 0.7 }}>{previewCardName}</span>}
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginLeft: "auto" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "0.8rem" }}>
            <input type="checkbox" checked={showGrid} onChange={(e) => setShowGrid(e.target.checked)} /> Grid
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "0.8rem" }}>
            <input type="checkbox" checked={snap} onChange={(e) => setSnap(e.target.checked)} /> Snap
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "0.8rem" }}>
            <input type="checkbox" checked={showSample} onChange={(e) => setShowSample(e.target.checked)} /> Sample
          </label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) {
                setSampleUrl(URL.createObjectURL(f));
                setShowSample(true);
                setView("preview");
              }
            }}
            style={{ maxWidth: 140, fontSize: "0.75rem" }}
          />
          <button type="button" className={styles.secondaryBtn} style={btn} onClick={() => void pasteSample()}>Paste art</button>
        </div>
      </div>
      {info && <p className={styles.subtitle} style={{ margin: 0 }}>{info}</p>}
      <p className={styles.subtitle} style={{ fontSize: "0.75rem", margin: 0, opacity: 0.7 }}>
        Ctrl/Cmd+Z undo · Ctrl/Cmd+Shift+Z redo · Ctrl/Cmd+S save · Delete remove · Arrows nudge (Shift×10) · Ctrl/Cmd+D duplicate · Esc deselect
      </p>

      {/* Main workspace */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `${PREVIEW_W}px minmax(280px, 1fr) minmax(320px, 1.2fr)`,
          gap: "1rem",
          alignItems: "start",
        }}
      >
        {/* Canvas */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", gap: 4 }}>
            <button type="button" className={view === "edit" ? styles.primaryBtn : styles.secondaryBtn} style={btn} onClick={() => setView("edit")}>Edit</button>
            <button type="button" className={view === "preview" ? styles.primaryBtn : styles.secondaryBtn} style={btn} onClick={() => setView("preview")}>Preview</button>
          </div>
          {view === "preview" ? (
            <canvas
              ref={previewCanvas}
              width={CARD_W}
              height={CARD_H}
              style={{
                width: PREVIEW_W,
                height: CARD_H * SCALE,
                borderRadius: 8,
                background: "#111",
                border: "1px solid rgba(255,255,255,0.08)",
                display: "block",
              }}
            />
          ) : (
        <div
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
          style={{
            position: "relative",
            width: PREVIEW_W,
            height: CARD_H * SCALE,
            background: showSample && sampleUrl ? `url(${sampleUrl}) center/cover` : "#1a1a1a",
            borderRadius: 8,
            overflow: "hidden",
            touchAction: "none",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          {showGrid && (
            <svg width={PREVIEW_W} height={CARD_H * SCALE} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
              {Array.from({ length: Math.ceil(CARD_W / GRID) }, (_, i) => (
                <line key={`v${i}`} x1={i * GRID * SCALE} y1={0} x2={i * GRID * SCALE} y2={CARD_H * SCALE} stroke="rgba(255,255,255,0.12)" />
              ))}
              {Array.from({ length: Math.ceil(CARD_H / GRID) }, (_, i) => (
                <line key={`h${i}`} x1={0} y1={i * GRID * SCALE} x2={PREVIEW_W} y2={i * GRID * SCALE} stroke="rgba(255,255,255,0.12)" />
              ))}
            </svg>
          )}
          {[...elements].sort((a, b) => a.zIndex - b.zIndex).map((el) => (
            <div
              key={el.id}
              onPointerDown={(e) => onPointerDown(e, el.id, "move")}
              style={{
                position: "absolute",
                left: el.x * SCALE,
                top: el.y * SCALE,
                width: el.width * SCALE,
                height: el.height * SCALE,
                background: resolveColor(el.backgroundSource, el.background, el.backgroundOpacity, artPreview),
                border: selected === el.id ? "2px solid #4af" : `${Math.max(1, el.borderWidth * SCALE)}px solid ${resolveColor(el.borderSource, el.borderColor, el.borderOpacity, artPreview)}`,
                color: resolveColor(el.colorSource, el.color, el.colorOpacity, artPreview),
                fontSize: Math.max(9, el.fontSize * SCALE),
                fontWeight: el.fontWeight,
                fontStyle: el.fontStyle,
                display: "flex",
                alignItems: el.verticalAlign === "top" ? "flex-start" : el.verticalAlign === "bottom" ? "flex-end" : "center",
                justifyContent: el.textAlign === "center" ? "center" : el.textAlign === "right" ? "flex-end" : "flex-start",
                padding: 2,
                boxSizing: "border-box",
                cursor: "move",
                userSelect: "none",
                overflow: "hidden",
                zIndex: el.zIndex,
                borderRadius: el.cornerRadius * SCALE,
              }}
            >
              {el.type}
              <div
                onPointerDown={(e) => onPointerDown(e, el.id, "resize")}
                style={{
                  position: "absolute",
                  right: -4,
                  bottom: -4,
                  width: 12,
                  height: 12,
                  background: "#4af",
                  borderRadius: 2,
                  cursor: "nwse-resize",
                }}
              />
            </div>
          ))}
        </div>
          )}
        </div>

        {/* Layers / add / align */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", minWidth: 0 }}>
          <div>
            <div className={styles.label}>Add element</div>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {TYPES.map((t) => (
                <button key={t} type="button" className={styles.secondaryBtn} style={btn} onClick={() => add(t)}>+ {t}</button>
              ))}
            </div>
          </div>

          <div>
            <div className={styles.label}>Align to canvas</div>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {(["left", "center", "right", "top", "middle", "bottom"] as const).map((a) => (
                <button key={a} type="button" className={styles.secondaryBtn} style={btn} disabled={!sel} onClick={() => align(a)}>{a}</button>
              ))}
            </div>
          </div>

          <div>
            <div className={styles.label}>Layers</div>
            <div style={{ maxHeight: 280, overflow: "auto", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6 }}>
              {ordered.map((el) => (
                <div
                  key={el.id}
                  onClick={() => setSelected(el.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "6px 8px",
                    background: selected === el.id ? "rgba(68,170,255,0.15)" : "transparent",
                    cursor: "pointer",
                    fontSize: "0.85rem",
                    borderBottom: "1px solid rgba(255,255,255,0.04)",
                  }}
                >
                  <span style={{ flex: 1 }}>{el.type}</span>
                  <button type="button" className={styles.secondaryBtn} style={{ ...btn, padding: "0.2rem 0.5rem" }} onClick={(e) => { e.stopPropagation(); bring(el.id, "forward"); }}>↑</button>
                  <button type="button" className={styles.secondaryBtn} style={{ ...btn, padding: "0.2rem 0.5rem" }} onClick={(e) => { e.stopPropagation(); bring(el.id, "backward"); }}>↓</button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Inspector */}
        <div style={{ minWidth: 0 }}>
          {sel ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <div>
                <div className={styles.label}>Geometry</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "0.4rem" }}>
                  <Num label="X" value={sel.x} onChange={(v) => updateSelected({ x: v })} />
                  <Num label="Y" value={sel.y} onChange={(v) => updateSelected({ y: v })} />
                  <Num label="W" value={sel.width} onChange={(v) => updateSelected({ width: v })} />
                  <Num label="H" value={sel.height} onChange={(v) => updateSelected({ height: v })} />
                </div>
              </div>

              <div>
                <div className={styles.label}>Typography</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.4rem" }}>
                  <Num label="Font size" value={sel.fontSize} onChange={(v) => updateSelected({ fontSize: v })} />
                  <Select label="Weight" value={sel.fontWeight} options={["300", "400", "500", "700", "normal", "bold"]} onChange={(v) => updateSelected({ fontWeight: v as OverlayElement["fontWeight"] })} />
                  <Select label="Style" value={sel.fontStyle} options={["normal", "italic"]} onChange={(v) => updateSelected({ fontStyle: v as OverlayElement["fontStyle"] })} />
                  <Select label="Font" value={sel.fontFamily || "serif"} options={["serif", "sans-serif", "monospace"]} onChange={(v) => updateSelected({ fontFamily: v })} />
                  <Select label="H align" value={sel.textAlign} options={["left", "center", "right"]} onChange={(v) => updateSelected({ textAlign: v as OverlayElement["textAlign"] })} />
                  <Select label="V align" value={sel.verticalAlign} options={["top", "middle", "bottom"]} onChange={(v) => updateSelected({ verticalAlign: v as OverlayElement["verticalAlign"] })} />
                  <Num label="Line height" value={sel.lineHeight || 1.25} step={0.05} onChange={(v) => updateSelected({ lineHeight: v })} />
                  <Num label="Letter spacing" value={sel.letterSpacing || 0} onChange={(v) => updateSelected({ letterSpacing: v })} />
                  <Num label="Max lines" value={sel.maxLines || 0} onChange={(v) => updateSelected({ maxLines: v })} />
                  <Select label="Wrap" value={sel.wrapMode || "wrap"} options={["wrap", "nowrap", "ellipsis"]} onChange={(v) => updateSelected({ wrapMode: v as OverlayElement["wrapMode"] })} />
                  <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "0.8rem" }}>
                    <input type="checkbox" checked={!!sel.fitText} onChange={(e) => updateSelected({ fitText: e.target.checked })} />
                    Fit text
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "0.8rem" }}>
                    <input type="checkbox" checked={!!sel.fitWidth} onChange={(e) => updateSelected({ fitWidth: e.target.checked })} />
                    Fit width
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "0.8rem" }}>
                    <input type="checkbox" checked={!!sel.autoGrow} onChange={(e) => updateSelected({ autoGrow: e.target.checked })} />
                    Auto-grow
                  </label>
                </div>
              </div>

              <div>
                <div className={styles.label}>Box</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.4rem" }}>
                  <Num label="Padding" value={sel.padding} onChange={(v) => updateSelected({ padding: v })} />
                  <Num label="Radius" value={sel.cornerRadius} onChange={(v) => updateSelected({ cornerRadius: v })} />
                  <Num label="Border width" value={sel.borderWidth} onChange={(v) => updateSelected({ borderWidth: v })} />
                </div>
              </div>

              <div>
                <div className={styles.label}>Effects</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.8rem" }}>
                    <span style={{ minWidth: 56 }}>Shadow</span>
                    <input type="color" value={sel.textShadow || "#000000"} onChange={(e) => updateSelected({ textShadow: e.target.value })} />
                    <button type="button" className={styles.secondaryBtn} style={btn} onClick={() => updateSelected({ textShadow: "" })}>Clear</button>
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.8rem" }}>
                    <span style={{ minWidth: 56 }}>Outline</span>
                    <input type="color" value={sel.textOutline || "#000000"} onChange={(e) => updateSelected({ textOutline: e.target.value })} />
                    <Num label="" value={sel.textOutlineWidth || 0} onChange={(v) => updateSelected({ textOutlineWidth: v })} />
                    <button type="button" className={styles.secondaryBtn} style={btn} onClick={() => updateSelected({ textOutline: "", textOutlineWidth: 0 })}>Clear</button>
                  </label>
                  <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 6, marginTop: 4 }}>
                    <div style={{ fontSize: "0.75rem", opacity: 0.7, marginBottom: 4 }}>Highlighter</div>
                    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.8rem", flexWrap: "wrap" }}>
                      <span style={{ minWidth: 56 }}>Color</span>
                      <input type="color" value={sel.highlightColor || "#f5e27a"} onChange={(e) => updateSelected({ highlightColor: e.target.value })} />
                      <button type="button" className={styles.secondaryBtn} style={btn} onClick={() => updateSelected({ highlightColor: "" })}>Off</button>
                      <select
                        className={styles.input}
                        value={sel.highlightStyle || "brush"}
                        onChange={(e) => updateSelected({ highlightStyle: e.target.value as OverlayElement["highlightStyle"] })}
                        style={{ maxWidth: 120, margin: 0 }}
                      >
                        <option value="brush">Brush</option>
                        <option value="paint">Paint texture</option>
                        <option value="marker">Marker</option>
                        <option value="wash">Wash</option>
                        <option value="ribbon">Ribbon</option>
                        <option value="double">Double</option>
                        <option value="fade">Fade</option>
                        <option value="chalk">Chalk</option>
                        <option value="underline">Underline</option>
                      </select>
                      <select
                        className={styles.input}
                        value={sel.highlightMode || "line"}
                        onChange={(e) => updateSelected({ highlightMode: e.target.value as OverlayElement["highlightMode"] })}
                        style={{ maxWidth: 100, margin: 0 }}
                      >
                        <option value="line">Per line</option>
                        <option value="block">One block</option>
                      </select>
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.8rem", marginTop: 4 }}>
                      <span style={{ minWidth: 56 }}>Opacity</span>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.05}
                        value={sel.highlightOpacity ?? 0.55}
                        onChange={(e) => updateSelected({ highlightOpacity: Number(e.target.value) })}
                        style={{ flex: 1 }}
                      />
                      <span>{Math.round((sel.highlightOpacity ?? 0.55) * 100)}%</span>
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.8rem", marginTop: 4 }}>
                      <span style={{ minWidth: 56 }}>Spread H</span>
                      <input
                        type="range"
                        min={0}
                        max={40}
                        step={1}
                        value={sel.highlightSpread ?? 6}
                        onChange={(e) => updateSelected({ highlightSpread: Number(e.target.value) })}
                        style={{ flex: 1 }}
                      />
                      <span>{sel.highlightSpread ?? 6}px</span>
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.8rem", marginTop: 4 }}>
                      <span style={{ minWidth: 56 }}>Spread V</span>
                      <input
                        type="range"
                        min={0}
                        max={40}
                        step={1}
                        value={sel.highlightSpreadY ?? 4}
                        onChange={(e) => updateSelected({ highlightSpreadY: Number(e.target.value) })}
                        style={{ flex: 1 }}
                      />
                      <span>{sel.highlightSpreadY ?? 4}px</span>
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.8rem", marginTop: 4 }}>
                      <span style={{ minWidth: 56 }}>Offset X</span>
                      <input
                        type="range"
                        min={-40}
                        max={40}
                        step={1}
                        value={sel.highlightOffsetX ?? 0}
                        onChange={(e) => updateSelected({ highlightOffsetX: Number(e.target.value) })}
                        style={{ flex: 1 }}
                      />
                      <span>{sel.highlightOffsetX ?? 0}px</span>
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.8rem", marginTop: 4 }}>
                      <span style={{ minWidth: 56 }}>Offset Y</span>
                      <input
                        type="range"
                        min={-40}
                        max={40}
                        step={1}
                        value={sel.highlightOffsetY ?? 0}
                        onChange={(e) => updateSelected({ highlightOffsetY: Number(e.target.value) })}
                        style={{ flex: 1 }}
                      />
                      <span>{sel.highlightOffsetY ?? 0}px</span>
                    </label>
                  </div>
                </div>
              </div>

              <div>
                <div className={styles.label}>Colors</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <ColorField
                    label="Text"
                    source={sel.colorSource}
                    color={sel.color}
                    opacity={sel.colorOpacity}
                    onSource={(s) => updateSelected({ colorSource: s })}
                    onColor={(c) => updateSelected({ color: c })}
                    onOpacity={(o) => updateSelected({ colorOpacity: o })}
                  />
                  <ColorField
                    label="Background"
                    source={sel.backgroundSource}
                    color={sel.background}
                    opacity={sel.backgroundOpacity}
                    onSource={(s) => updateSelected({ backgroundSource: s })}
                    onColor={(c) => updateSelected({ background: c })}
                    onOpacity={(o) => updateSelected({ backgroundOpacity: o })}
                  />
                  <ColorField
                    label="Border"
                    source={sel.borderSource}
                    color={sel.borderColor}
                    opacity={sel.borderOpacity}
                    onSource={(s) => updateSelected({ borderSource: s })}
                    onColor={(c) => updateSelected({ borderColor: c })}
                    onOpacity={(o) => updateSelected({ borderOpacity: o })}
                  />
                </div>
              </div>

              {sel.type === "customText" && (
                <div>
                  <label className={styles.label}>Custom text</label>
                  <input className={styles.input} value={sel.customText || ""} onChange={(e) => updateSelected({ customText: e.target.value })} />
                </div>
              )}

              <button
                type="button"
                className={styles.secondaryBtn}
                style={{ ...btn, width: "100%" }}
                onClick={() => {
                  pushHistory();
                  setElements((prev) => prev.filter((e) => e.id !== sel.id));
                  setSelected(null);
                }}
              >
                Remove element
              </button>
            </div>
          ) : (
            <p className={styles.subtitle}>Select an element on the canvas or in Layers to edit it.</p>
          )}
        </div>
      </div>
    </div>
  );
}
function Num({ label, value, onChange, step = 1 }: { label: string; value: number; onChange: (v: number) => void; step?: number }) {
  return (
    <label style={{ fontSize: "0.8rem" }}>
      {label}
      <input
        className={styles.input}
        type="number"
        step={step}
        value={step < 1 ? value : Math.round(value)}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <label style={{ fontSize: "0.8rem" }}>
      {label}
      <select className={styles.input} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </label>
  );
}

function ColorField({
  label,
  source,
  color,
  opacity,
  onSource,
  onColor,
  onOpacity,
}: {
  label: string;
  source: ColorSource;
  color: string;
  opacity: number;
  onSource: (s: ColorSource) => void;
  onColor: (c: string) => void;
  onOpacity: (o: number) => void;
}) {
  const hex = toHex(color);
  return (
    <div style={{ gridColumn: "1 / -1", borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 6 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <span style={{ fontSize: "0.8rem", minWidth: 72 }}>{label}</span>
        <select className={styles.input} value={source} onChange={(e) => onSource(e.target.value as ColorSource)} style={{ maxWidth: 110 }}>
          <option value="custom">Custom</option>
          <option value="art">Art color</option>
        </select>
        {source === "custom" && (
          <input type="color" value={hex} onChange={(e) => onColor(e.target.value)} />
        )}
        <span style={{ fontSize: "0.75rem" }}>Opacity {Math.round(opacity * 100)}%</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={opacity}
          onChange={(e) => onOpacity(Number(e.target.value))}
          style={{ flex: 1, minWidth: 80 }}
        />
      </div>
    </div>
  );
}

function toHex(color: string): string {
  if (color.startsWith("#") && color.length === 7) return color;
  if (color.startsWith("#") && color.length === 4) {
    return "#" + color[1] + color[1] + color[2] + color[2] + color[3] + color[3];
  }
  const m = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (m) {
    const h = (n: string) => Number(n).toString(16).padStart(2, "0");
    return `#${h(m[1])}${h(m[2])}${h(m[3])}`;
  }
  return "#888888";
}

