import { useEffect, useRef, useState } from "react";
import { ZONES } from "../layout/siteMap";
import {
  clearSkyImage,
  moveNode,
  nodesFor,
  resetNodes,
  setSkyImage,
  skyImageUrl,
  subscribeSky,
  type SkySide,
} from "../lib/skyPlot";
import styles from "./SkyPlotter.module.css";

const BUILTIN: Record<SkySide, string> = {
  desktop: "/map-sky-desktop.jpg?v=pair",
  mobile: "/map-sky-mobile.jpg?v=pair",
};

export function SkyPlotter() {
  const [side, setSide] = useState<SkySide>("desktop");
  const [nodes, setNodes] = useState(() => nodesFor("desktop"));
  const [customUrl, setCustomUrl] = useState<string | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    setNodes(nodesFor(side));
    let dead = false;
    void skyImageUrl(side).then((url) => {
      if (dead) {
        if (url) URL.revokeObjectURL(url);
        return;
      }
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = url;
      setCustomUrl(url);
    });
    return () => {
      dead = true;
    };
  }, [side]);

  useEffect(() => subscribeSky(() => setNodes(nodesFor(side))), [side]);

  useEffect(() => {
    return () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, []);

  function drag(id: string, event: React.PointerEvent) {
    const board = boardRef.current;
    if (!board) return;
    event.preventDefault();
    const place = (ev: PointerEvent) => {
      const rect = board.getBoundingClientRect();
      const x = (ev.clientX - rect.left) / rect.width;
      const y = (ev.clientY - rect.top) / rect.height;
      moveNode(side, id, x, y);
    };
    place(event.nativeEvent);
    const move = (ev: PointerEvent) => place(ev);
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  return (
    <section className={styles.plot}>
      <div className={styles.head}>
        <h2 className={styles.title}>Sky plotter</h2>
        <div className={styles.sides}>
          {(["desktop", "mobile"] as const).map((next) => (
            <button
              key={next}
              type="button"
              className={`${styles.side}${side === next ? ` ${styles.sideOn}` : ""}`}
              onClick={() => setSide(next)}
            >
              {next === "desktop" ? "Desktop" : "Mobile"}
            </button>
          ))}
        </div>
      </div>
      <p className={styles.note}>
        Drag each page onto its glow. This browser uses the layout while SkyNav is on.
      </p>
      <div className={styles.tools}>
        <label className={styles.file}>
          Set sky
          <input
            type="file"
            accept="image/*"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void setSkyImage(side, file);
            }}
          />
        </label>
        <button type="button" className={styles.tool} onClick={() => resetNodes(side)}>
          Reset nodes
        </button>
        <button type="button" className={styles.tool} onClick={() => void clearSkyImage(side)}>
          Use built-in sky
        </button>
      </div>
      <div className={styles.board} ref={boardRef}>
        <img src={customUrl ?? BUILTIN[side]} alt="" draggable={false} />
        {Object.values(ZONES).map((zone) => {
          const node = nodes[zone.id];
          return (
            <button
              key={zone.id}
              type="button"
              className={`${styles.node} ${styles[zone.cluster]}`}
              style={{ left: `${node.x * 100}%`, top: `${node.y * 100}%` }}
              onPointerDown={(event) => drag(zone.id, event)}
            >
              {zone.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}
