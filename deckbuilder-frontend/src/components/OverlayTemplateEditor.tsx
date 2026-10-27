import { useEffect, useRef, useState } from "react";
import styles from "../pages/LoginPage.module.css";
import {
  CARD_H,
  CARD_W,
  deleteTemplate,
  loadTemplates,
  newElement,
  upsertTemplate,
  type OverlayElement,
  type OverlayElementType,
  type OverlayTemplate,
} from "../lib/overlayTemplates";

const PREVIEW_W = 320;
const SCALE = PREVIEW_W / CARD_W;

const TYPES: OverlayElementType[] = ["name", "mana", "typeLine", "rules", "pt", "customText"];

export function OverlayTemplateEditor() {
  const [templates, setTemplates] = useState<OverlayTemplate[]>([]);
  const [currentId, setCurrentId] = useState<string>("");
  const [name, setName] = useState("");
  const [elements, setElements] = useState<OverlayElement[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
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
    const el = newElement(type);
    setElements((prev) => [...prev, el]);
    setSelected(el.id);
  }

  function updateSelected(patch: Partial<OverlayElement>) {
    if (!selected) return;
    setElements((prev) => prev.map((e) => (e.id === selected ? { ...e, ...patch } : e)));
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
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current) return;
    const dx = (e.clientX - drag.current.sx) / SCALE;
    const dy = (e.clientY - drag.current.sy) / SCALE;
    const { id, mode, ox, oy, ow, oh } = drag.current;
    setElements((prev) =>
      prev.map((el) => {
        if (el.id !== id) return el;
        if (mode === "move") {
          return {
            ...el,
            x: Math.max(0, Math.min(CARD_W - 20, ox + dx)),
            y: Math.max(0, Math.min(CARD_H - 20, oy + dy)),
          };
        }
        return {
          ...el,
          width: Math.max(40, ow + dx),
          height: Math.max(24, oh + dy),
        };
      })
    );
  }

  function onPointerUp() {
    drag.current = null;
  }

  const sel = elements.find((e) => e.id === selected) ?? null;

  return (
    <div>
      <div className={styles.field}>
        <label className={styles.label}>Template</label>
        <select
          className={styles.input}
          value={currentId}
          onChange={(e) => load(e.target.value)}
        >
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <input
          className={styles.input}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Template name"
          style={{ marginTop: "0.4rem" }}
        />
        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginTop: "0.4rem" }}>
          <button type="button" className={styles.primaryBtn} onClick={save}>
            Save
          </button>
          <button type="button" className={styles.secondaryBtn} onClick={saveAs}>
            Save as
          </button>
          <button type="button" className={styles.secondaryBtn} onClick={remove}>
            Delete
          </button>
        </div>
        {info && <p className={styles.subtitle}>{info}</p>}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "1rem", alignItems: "start" }}>
        <div
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
          style={{
            position: "relative",
            width: PREVIEW_W,
            height: CARD_H * SCALE,
            background: "#1a1a1a",
            borderRadius: 8,
            overflow: "hidden",
            touchAction: "none",
          }}
        >
          {elements.map((el) => (
            <div
              key={el.id}
              onPointerDown={(e) => onPointerDown(e, el.id, "move")}
              style={{
                position: "absolute",
                left: el.x * SCALE,
                top: el.y * SCALE,
                width: el.width * SCALE,
                height: el.height * SCALE,
                background: el.background === "transparent" ? "rgba(255,255,255,0.08)" : el.background,
                border:
                  selected === el.id
                    ? "2px solid #4af"
                    : `${Math.max(1, el.borderWidth * SCALE)}px solid ${el.borderColor}`,
                color: el.color,
                fontSize: Math.max(9, el.fontSize * SCALE),
                fontWeight: el.fontWeight,
                fontStyle: el.fontStyle,
                display: "flex",
                alignItems: "center",
                justifyContent: el.textAlign === "center" ? "center" : el.textAlign === "right" ? "flex-end" : "flex-start",
                padding: "0 4px",
                boxSizing: "border-box",
                cursor: "move",
                userSelect: "none",
                overflow: "hidden",
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

        <div>
          <div className={styles.field}>
            <label className={styles.label}>Add element</label>
            <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap" }}>
              {TYPES.map((t) => (
                <button key={t} type="button" className={styles.secondaryBtn} onClick={() => add(t)}>
                  + {t}
                </button>
              ))}
            </div>
          </div>

          {sel ? (
            <div className={styles.field}>
              <label className={styles.label}>Selected: {sel.type}</label>
              <label className={styles.label}>X</label>
              <input
                className={styles.input}
                type="number"
                value={Math.round(sel.x)}
                onChange={(e) => updateSelected({ x: Number(e.target.value) })}
              />
              <label className={styles.label}>Y</label>
              <input
                className={styles.input}
                type="number"
                value={Math.round(sel.y)}
                onChange={(e) => updateSelected({ y: Number(e.target.value) })}
              />
              <label className={styles.label}>Width</label>
              <input
                className={styles.input}
                type="number"
                value={Math.round(sel.width)}
                onChange={(e) => updateSelected({ width: Number(e.target.value) })}
              />
              <label className={styles.label}>Height</label>
              <input
                className={styles.input}
                type="number"
                value={Math.round(sel.height)}
                onChange={(e) => updateSelected({ height: Number(e.target.value) })}
              />
              <label className={styles.label}>Font size</label>
              <input
                className={styles.input}
                type="number"
                value={sel.fontSize}
                onChange={(e) => updateSelected({ fontSize: Number(e.target.value) })}
              />
              <label className={styles.label}>Text color</label>
              <input
                className={styles.input}
                type="color"
                value={toHex(sel.color)}
                onChange={(e) => updateSelected({ color: e.target.value })}
              />
              <label className={styles.label}>Background (CSS)</label>
              <input
                className={styles.input}
                value={sel.background}
                onChange={(e) => updateSelected({ background: e.target.value })}
              />
              <label className={styles.label}>Border color</label>
              <input
                className={styles.input}
                type="color"
                value={toHex(sel.borderColor)}
                onChange={(e) => updateSelected({ borderColor: e.target.value })}
              />
              <label className={styles.label}>Border width</label>
              <input
                className={styles.input}
                type="number"
                value={sel.borderWidth}
                onChange={(e) => updateSelected({ borderWidth: Number(e.target.value) })}
              />
              <label className={styles.label}>Align</label>
              <select
                className={styles.input}
                value={sel.textAlign}
                onChange={(e) => updateSelected({ textAlign: e.target.value as OverlayElement["textAlign"] })}
              >
                <option value="left">left</option>
                <option value="center">center</option>
                <option value="right">right</option>
              </select>
              <label className={styles.label}>Weight</label>
              <select
                className={styles.input}
                value={sel.fontWeight}
                onChange={(e) => updateSelected({ fontWeight: e.target.value as OverlayElement["fontWeight"] })}
              >
                <option value="normal">normal</option>
                <option value="bold">bold</option>
              </select>
              <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginTop: "0.4rem" }}>
                <input
                  type="checkbox"
                  checked={!!sel.useArtBorder}
                  onChange={(e) => updateSelected({ useArtBorder: e.target.checked })}
                />
                Use average art color for border
              </label>
              {sel.type === "customText" && (
                <>
                  <label className={styles.label}>Custom text</label>
                  <input
                    className={styles.input}
                    value={sel.customText || ""}
                    onChange={(e) => updateSelected({ customText: e.target.value })}
                  />
                </>
              )}
              <button
                type="button"
                className={styles.secondaryBtn}
                style={{ marginTop: "0.5rem" }}
                onClick={() => {
                  setElements((prev) => prev.filter((e) => e.id !== sel.id));
                  setSelected(null);
                }}
              >
                Remove element
              </button>
            </div>
          ) : (
            <p className={styles.subtitle}>Select an element on the preview to edit it.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function toHex(color: string): string {
  if (color.startsWith("#") && (color.length === 7 || color.length === 4)) return color.length === 4
    ? "#" + color[1] + color[1] + color[2] + color[2] + color[3] + color[3]
    : color;
  return "#888888";
}
