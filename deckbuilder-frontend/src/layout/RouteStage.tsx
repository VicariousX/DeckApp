import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useLocation, type Location } from "react-router-dom";
import { AppRoutes } from "./AppRoutes";
import { GRID, placeKey, zoneFor, ZONES, type Zone } from "./siteMap";

type Frame = { id: number; loc: Location };
type Travel = {
  from: Zone;
  to: Zone;
  fromId: number;
  toId: number;
  same: boolean;
  motion: "pan" | "flight";
  ms: number;
};

const FIT = 0.9 / Math.max(GRID.cols, GRID.rows);

function camera(col: number, row: number, scale: number) {
  const x = (100 * (0.5 - (col + 0.5) * scale)) / GRID.cols;
  const y = (100 * (0.5 - (row + 0.5) * scale)) / GRID.rows;
  return `translate(${x}%, ${y}%) scale(${scale})`;
}

function framesOf(travel: Travel): Keyframe[] {
  const { from, to, same, motion } = travel;
  if (motion === "pan") {
    return [
      { offset: 0, transform: camera(from.col, from.row, 1) },
      { offset: 1, transform: camera(to.col, to.row, 1) },
    ];
  }
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

function travelPlan(from: Zone, to: Zone, mobile: boolean): Pick<Travel, "motion" | "ms" | "same"> {
  const same = from.id === to.id;
  const motion = to.heavy ? "flight" : "pan";
  if (motion === "pan") {
    const dist = Math.hypot(to.col - from.col, to.row - from.row);
    const near = from.cluster === to.cluster;
    const ms = Math.round(Math.min(mobile ? 380 : 460, (near ? 240 : 300) + dist * (near ? 36 : 55)));
    return { motion, ms, same };
  }
  return { motion, same, ms: same ? (mobile ? 700 : 860) : mobile ? 1100 : 1400 };
}

const PLATES = [
  { id: "search", label: "Search", col: 0, row: 0, cols: 5, rows: 1 },
  { id: "home", label: "Home", col: 1, row: 1, cols: 5, rows: 1 },
  { id: "library", label: "Library", col: 0, row: 2, cols: 4, rows: 1 },
  { id: "table", label: "Table", col: 4, row: 2, cols: 2, rows: 2 },
] as const;

function plateStyle(plate: (typeof PLATES)[number]): CSSProperties {
  const padX = 0.45;
  const padY = 0.35;
  return {
    left: `${(plate.col / GRID.cols) * 100 + padX}%`,
    top: `${(plate.row / GRID.rows) * 100 + padY}%`,
    width: `${(plate.cols / GRID.cols) * 100 - padX * 2}%`,
    height: `${(plate.rows / GRID.rows) * 100 - padY * 2}%`,
  };
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
      const plan = travelPlan(from, to, mobile);
      setFrames((current) => [...current, { id: nextId, loc: live }]);
      setTravel({
        from,
        to,
        fromId: top.id,
        toId: nextId,
        ...plan,
      });
    }
  }

  useEffect(() => {
    if (!travel) return;
    const world = worldRef.current;
    const anim = world?.animate(framesOf(travel), {
      duration: travel.ms,
      easing: travel.motion === "pan" ? "cubic-bezier(0.2, 0.8, 0.2, 1)" : "linear",
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

  const flight = travel?.motion === "flight";

  const skyZone = zoneFor(placeKey(top.loc.pathname, top.loc.search));

  return (
    <div className={`route-stage${travel ? " is-traveling" : ""}${flight ? " is-flight" : ""}${fade ? " is-fading" : ""}`}>
      <div
        className="map-sky"
        aria-hidden
        style={
          {
            ["--cols" as string]: String(GRID.cols),
            ["--rows" as string]: String(GRID.rows),
            ["--col" as string]: String(skyZone.col),
            ["--row" as string]: String(skyZone.row),
          } as CSSProperties
        }
      />
      <div
        ref={worldRef}
        className={travel ? `map-world${flight ? " is-flight" : ""}` : "route-hold"}
        style={
          travel
            ? ({
                ["--cols" as string]: String(GRID.cols),
                ["--rows" as string]: String(GRID.rows),
                transform: String(framesOf(travel)[0]?.transform ?? "none"),
              } as CSSProperties)
            : undefined
        }
      >
        {flight &&
          PLATES.map((plate) => (
            <div key={plate.id} className={`map-plate map-plate-${plate.id}`} style={plateStyle(plate)}>
              <span>{plate.label}</span>
            </div>
          ))}
        {flight &&
          Object.values(ZONES).map((zone) =>
            occupied.has(zone.id) ? null : (
              <div key={zone.id} className="map-stand-slot" style={cellStyle(zone)}>
                <div className={`map-stand${zone.heavy ? " is-heavy" : ""}`} data-cluster={zone.cluster}>
                  <header>{zone.label}</header>
                  <div className="map-stand-body" />
                </div>
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
                  ? `map-frame${flight ? " is-card" : ""}${incoming && travel.same ? " is-incoming" : ""}`
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
