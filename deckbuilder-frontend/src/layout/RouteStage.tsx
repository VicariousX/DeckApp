import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { GRID, placeKey, zoneAt, zoneFor, type Zone } from "./siteMap";

type Travel = { from: Zone; to: Zone; same: boolean; ms: number };

const FIT = 0.9 / Math.max(GRID.cols, GRID.rows);

function camera(col: number, row: number, scale: number) {
  const x = (100 * (0.5 - (col + 0.5) * scale)) / GRID.cols;
  const y = (100 * (0.5 - (row + 0.5) * scale)) / GRID.rows;
  return `translate(${x}%, ${y}%) scale(${scale})`;
}

function frames(travel: Travel): Keyframe[] {
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

function GridFlight({ travel, children }: { travel: Travel; children: ReactNode }) {
  const worldRef = useRef<HTMLDivElement>(null);
  const cells = [];
  for (let row = 0; row < GRID.rows; row += 1) {
    for (let col = 0; col < GRID.cols; col += 1) {
      const zone = zoneAt(col, row);
      const here = zone?.id === travel.to.id;
      cells.push(
        <div
          key={`${col}-${row}`}
          className={`map-cell${zone ? "" : " is-empty"}${zone?.id === travel.from.id ? " is-from" : ""}${here ? " is-to" : ""}`}
        >
          {here ? (
            <div className="map-page">{children}</div>
          ) : (
            zone && <span className="map-label">{zone.label}</span>
          )}
        </div>
      );
    }
  }

  useEffect(() => {
    const world = worldRef.current;
    if (!world) return;
    const anim = world.animate(frames(travel), {
      duration: travel.ms,
      easing: "linear",
      fill: "both",
    });
    return () => anim.cancel();
  }, [travel]);

  return (
    <div className="map-view">
      <div
        ref={worldRef}
        className="map-world"
        style={{
          ["--cols" as string]: String(GRID.cols),
          ["--rows" as string]: String(GRID.rows),
          transform: String(frames(travel)[0]?.transform ?? "none"),
        }}
      >
        {cells}
      </div>
    </div>
  );
}

/** Zoom out to the site grid, pan to the next cell, then zoom in. */
export function RouteStage({ children }: { children: ReactNode }) {
  const location = useLocation();
  const locKey = placeKey(location.pathname, location.search);
  const prevKey = useRef(locKey);
  const [travel, setTravel] = useState<Travel | null>(null);
  const [fade, setFade] = useState(false);

  if (locKey !== prevKey.current) {
    const from = zoneFor(prevKey.current);
    const to = zoneFor(locKey);
    prevKey.current = locKey;
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setFade(true);
    } else {
      const mobile = window.matchMedia("(max-width: 720px)").matches;
      const same = from.id === to.id;
      setTravel({
        from,
        to,
        same,
        ms: same ? (mobile ? 800 : 980) : mobile ? 1150 : 1500,
      });
    }
  }

  useEffect(() => {
    if (!travel) return;
    const timer = window.setTimeout(() => setTravel(null), travel.ms + 30);
    return () => window.clearTimeout(timer);
  }, [travel]);

  useEffect(() => {
    if (!fade) return;
    const timer = window.setTimeout(() => setFade(false), 280);
    return () => window.clearTimeout(timer);
  }, [fade]);

  return (
    <div className={`route-stage${travel ? " is-traveling" : ""}${fade ? " is-fading" : ""}`}>
      {travel ? <GridFlight travel={travel}>{children}</GridFlight> : <div className="route-page">{children}</div>}
    </div>
  );
}
