import { useEffect, useMemo, useRef, useState } from "react";
import styles from "../pages/LoginPage.module.css";
import {
  CARD_H,
  CARD_W,
  deleteTemplate,
  loadTemplates,
  newElement,
  resolveColor,
  upsertTemplate,
  type ColorSource,
  type OverlayElement,
  type OverlayElementType,
  type OverlayTemplate,
} from "../lib/overlayTemplates";

const PREVIEW_W = 340;
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

  useEffect(() => {
    const all = loadTemplates();
    setTemplates(all);
    if (all[0]) {
      setCurrentId(all[0].id);
      setName(all[0].name);
      setElements(all[0].elements);
    }
  }, []);

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
        setElements((prev) => prev.filter((el) => el.id !== selected));
        setSelected(null);
        return;
      }
      if (e.key === "Escape") {
        setSelected(null);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "d") {
        e.preventDefault();
        const el = elements.find((x) => x.id === selected);
        if (!el) return;
        const copy = { ...el, id: Math.random().toString(36).slice(2, 10), x: el.x + 16, y: el.y + 16, zIndex: el.zIndex + 1 };
        setElements((prev) => [...prev, copy]);
        setSelected(copy.id);
        return;
      }
      if (e.key === "ArrowLeft") { e.preventDefault(); updateSelected({ x: Math.max(0, (elements.find(x => x.id === selected)?.x ?? 0) - step) }); }
      if (e.key === "ArrowRight") { e.preventDefault(); updateSelected({ x: (elements.find(x => x.id === selected)?.x ?? 0) + step }); }
      if (e.key === "ArrowUp") { e.preventDefault(); updateSelected({ y: Math.max(0, (elements.find(x => x.id === selected)?.y ?? 0) - step) }); }
      if (e.key === "ArrowDown") { e.preventDefault(); updateSelected({ y: (elements.find(x => x.id === selected)?.y ?? 0) + step }); }
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
    setCurrentId(t.id);
    setName(t.name);
    setElements(t.elements);
    setSelected(null);
    setInfo(null);
  }

  function save() {
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
    setInfo(`Saved “${template.name}”.`);
  }

  function saveAs() {
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
    setInfo(`Saved as “${template.name}”.`);
  }

  function remove() {
    if (!currentId) return;
    const all = deleteTemplate(currentId);
    setTemplates(all);
    if (all[0]) {
      setCurrentId(all[0].id);
      setName(all[0].name);
      setElements(all[0].elements);
    }
    setInfo("Template deleted.");
  }

  function add(type: OverlayElementType) {
    const z = elements.reduce((m, e) => Math.max(m, e.zIndex), 0) + 1;
    const el = newElement(type, z);
    setElements((prev) => [...prev, el]);
    setSelected(el.id);
  }

  function updateSelected(patch: Partial<OverlayElement>) {
    if (!selected) return;
    setElements((prev) => prev.map((e) => (e.id === selected ? { ...e, ...patch } : e)));
  }

  function setZ(id: string, z: number) {
    setElements((prev) => prev.map((e) => (e.id === id ? { ...e, zIndex: z } : e)));
  }

  function bring(id: string, dir: "front" | "back" | "forward" | "backward") {
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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      {/* Top bar */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", alignItems: "center" }}>
        <select className={styles.input} value={currentId} onChange={(e) => load(e.target.value)} style={{ maxWidth: 180 }}>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" style={{ maxWidth: 160 }} />
        <button type="button" className={styles.primaryBtn} onClick={save}>Save</button>
        <button type="button" className={styles.secondaryBtn} onClick={saveAs}>Save as</button>
        <button type="button" className={styles.secondaryBtn} onClick={remove}>Delete</button>
        <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "0.85rem" }}>
          <input type="checkbox" checked={showGrid} onChange={(e) => setShowGrid(e.target.checked)} /> Grid
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "0.85rem" }}>
          <input type="checkbox" checked={snap} onChange={(e) => setSnap(e.target.checked)} /> Snap
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "0.85rem" }}>
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
            }
          }}
          style={{ maxWidth: 140 }}
        />
      </div>
      {info && <p className={styles.subtitle}>{info}</p>}
      <p className={styles.subtitle} style={{ fontSize: "0.8rem" }}>
        Keys: Ctrl/Cmd+S save · Delete remove · Arrows nudge (Shift×10) · Ctrl/Cmd+D duplicate · Esc deselect
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(280px, 360px) 1fr", gap: "1rem", alignItems: "start" }}>
        {/* Canvas */}
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

        {/* Side tools */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", minWidth: 0 }}>
          <div>
            <div className={styles.label}>Add</div>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {TYPES.map((t) => (
                <button key={t} type="button" className={styles.secondaryBtn} onClick={() => add(t)}>+ {t}</button>
              ))}
            </div>
          </div>

          <div>
            <div className={styles.label}>Align to canvas</div>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {(["left", "center", "right", "top", "middle", "bottom"] as const).map((a) => (
                <button key={a} type="button" className={styles.secondaryBtn} disabled={!sel} onClick={() => align(a)}>{a}</button>
              ))}
            </div>
          </div>

          <div>
            <div className={styles.label}>Layers</div>
            <div style={{ maxHeight: 160, overflow: "auto", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6 }}>
              {ordered.map((el) => (
                <div
                  key={el.id}
                  onClick={() => setSelected(el.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "4px 8px",
                    background: selected === el.id ? "rgba(68,170,255,0.15)" : "transparent",
                    cursor: "pointer",
                    fontSize: "0.85rem",
                  }}
                >
                  <span style={{ flex: 1 }}>{el.type}</span>
                  <button type="button" className={styles.secondaryBtn} onClick={(e) => { e.stopPropagation(); bring(el.id, "forward"); }}>↑</button>
                  <button type="button" className={styles.secondaryBtn} onClick={(e) => { e.stopPropagation(); bring(el.id, "backward"); }}>↓</button>
                </div>
              ))}
            </div>
          </div>

          {sel ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.4rem" }}>
              <Num label="X" value={sel.x} onChange={(v) => updateSelected({ x: v })} />
              <Num label="Y" value={sel.y} onChange={(v) => updateSelected({ y: v })} />
              <Num label="W" value={sel.width} onChange={(v) => updateSelected({ width: v })} />
              <Num label="H" value={sel.height} onChange={(v) => updateSelected({ height: v })} />
              <Num label="Font" value={sel.fontSize} onChange={(v) => updateSelected({ fontSize: v })} />
              <Num label="Border" value={sel.borderWidth} onChange={(v) => updateSelected({ borderWidth: v })} />
              <Num label="Padding" value={sel.padding} onChange={(v) => updateSelected({ padding: v })} />
              <Num label="Radius" value={sel.cornerRadius} onChange={(v) => updateSelected({ cornerRadius: v })} />

              <Select label="H align" value={sel.textAlign} options={["left", "center", "right"]} onChange={(v) => updateSelected({ textAlign: v as OverlayElement["textAlign"] })} />
              <Select label="V align" value={sel.verticalAlign} options={["top", "middle", "bottom"]} onChange={(v) => updateSelected({ verticalAlign: v as OverlayElement["verticalAlign"] })} />
              <Select label="Weight" value={sel.fontWeight} options={["normal", "bold"]} onChange={(v) => updateSelected({ fontWeight: v as OverlayElement["fontWeight"] })} />
              <Select label="Style" value={sel.fontStyle} options={["normal", "italic"]} onChange={(v) => updateSelected({ fontStyle: v as OverlayElement["fontStyle"] })} />

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

              {sel.type === "customText" && (
                <div style={{ gridColumn: "1 / -1" }}>
                  <label className={styles.label}>Custom text</label>
                  <input className={styles.input} value={sel.customText || ""} onChange={(e) => updateSelected({ customText: e.target.value })} />
                </div>
              )}
              <button
                type="button"
                className={styles.secondaryBtn}
                style={{ gridColumn: "1 / -1" }}
                onClick={() => {
                  setElements((prev) => prev.filter((e) => e.id !== sel.id));
                  setSelected(null);
                }}
              >
                Remove element
              </button>
            </div>
          ) : (
            <p className={styles.subtitle}>Select an element to edit it.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function Num({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label style={{ fontSize: "0.8rem" }}>
      {label}
      <input
        className={styles.input}
        type="number"
        value={Math.round(value)}
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
