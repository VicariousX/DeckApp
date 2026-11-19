import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useLocation, type Location } from "react-router-dom";
import { AppRoutes } from "./AppRoutes";
import { GRID, placeKey, zoneFor, ZONES, type Zone } from "./siteMap";

type Frame = { id: number; loc: Location };
type Travel = { from: Zone; to: Zone; fromId: number; toId: number; same: boolean; ms: number };

const FIT = 0.9 / Math.max(GRID.cols, GRID.rows);

function camera(col: number, row: number, scale: number) {
  const x = (100 * (0.5 - (col + 0.5) * scale)) / GRID.cols;
  const y = (100 * (0.5 - (row + 0.5) * scale)) / GRID.rows;
  return `translate(${x}%, ${y}%) scale(${scale})`;
}

function framesOf(travel: Travel): Keyframe[] {
  const { from, to, same } = travel;
  if (same) {
    const mid = Math.min(0.42, FIT * 2.6);
    return [
      { offset: 0, transform: camera(from.col, from.row, 1) },
      { offset: 0.45, transform: camera(from.col, from.row, mid) },
      { offset: 1, transform: camera(to.col, to.row, 1) },
    ];
  }
  return [
    { offset: 0, transform: camera(from.col, from.row, 1) },
    { offset: 0.28, transform: camera(from.col, from.row, FIT) },
    { offset: 0.68, transform: camera(to.col, to.row, FIT) },
    { offset: 1, transform: camera(to.col, to.row, 1) },
  ];
}

function cellStyle(zone: Zone): CSSProperties {
  return {
    position: "absolute",
    left: `${(zone.col / GRID.cols) * 100}%`,
    top: `${(zone.row / GRID.rows) * 100}%`,
    width: `${100 / GRID.cols}%`,
    height: `${100 / GRID.rows}%`,
    overflow: "hidden",
  };
}

/**
 * One stage for the whole site, including the landing page.
 * The page you are leaving stays mounted and zooms out.
 * The page you are opening mounts at once, in its own cell, and renders while the camera pans.
 */
export function RouteStage() {
  const live = useLocation();
  const liveKey = placeKey(live.pathname, live.search);
  const [frames, setFrames] = useState<Frame[]>(() => [{ id: 1, loc: live }]);
  const [travel, setTravel] = useState<Travel | null>(null);
  const [fade, setFade] = useState(false);
  const worldRef = useRef<HTMLDivElement>(null);
  const top = frames[frames.length - 1];
  const topKey = placeKey(top.loc.pathname, top.loc.search);

  if (liveKey !== topKey && !travel) {
    const from = zoneFor(topKey);
    const to = zoneFor(liveKey);
    const nextId = top.id + 1;
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setFrames([{ id: nextId, loc: live }]);
      setFade(true);
    } else {
      const mobile = window.matchMedia("(max-width: 720px)").matches;
      const same = from.id === to.id;
      setFrames((current) => [...current, { id: nextId, loc: live }]);
      setTravel({
        from,
        to,
        fromId: top.id,
        toId: nextId,
        same,
        ms: same ? (mobile ? 800 : 980) : mobile ? 1200 : 1560,
      });
    }
  }

  useEffect(() => {
    if (!travel) return;
    const world = worldRef.current;
    const anim = world?.animate(framesOf(travel), {
      duration: travel.ms,
      easing: "linear",
      fill: "both",
    });
    const timer = window.setTimeout(() => {
      anim?.cancel();
      setFrames((current) => current.filter((frame) => frame.id === travel.toId));
      setTravel(null);
    }, travel.ms + 40);
    return () => {
      window.clearTimeout(timer);
      anim?.cancel();
    };
  }, [travel]);

  useEffect(() => {
    if (!fade) return;
    const timer = window.setTimeout(() => setFade(false), 280);
    return () => window.clearTimeout(timer);
  }, [fade]);

  const occupied = new Set(frames.map((frame) => zoneFor(placeKey(frame.loc.pathname, frame.loc.search)).id));

  return (
    <div className={`route-stage${travel ? " is-traveling" : ""}${fade ? " is-fading" : ""}`}>
      <div
        ref={worldRef}
        className={travel ? "map-world" : "route-hold"}
        style={
          travel
            ? {
                ["--cols" as string]: String(GRID.cols),
                ["--rows" as string]: String(GRID.rows),
                transform: framesOf(travel)[0]?.transform,
              }
            : undefined
        }
      >
        {travel &&
          Object.values(ZONES).map((zone) =>
            occupied.has(zone.id) ? null : (
              <div key={zone.id} className="map-cell" style={cellStyle(zone)}>
                <span className="map-label">{zone.label}</span>
              </div>
            )
          )}
        {frames.map((frame) => {
          const zone = zoneFor(placeKey(frame.loc.pathname, frame.loc.search));
          const incoming = travel?.toId === frame.id;
          return (
            <div
              key={frame.id}
              className={
                travel
                  ? `map-frame${incoming && travel.same ? " is-incoming" : ""}`
                  : "route-page"
              }
              style={travel ? { ...cellStyle(zone), animationDuration: `${travel.ms}ms` } : undefined}
            >
              <AppRoutes location={frame.loc} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
