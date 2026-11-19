import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { arc, CONSTELLATIONS, mapSpread, placeKey, ZONES, zoneFor, type Zone } from "./siteMap";

type Travel = { from: Zone; to: Zone; same: boolean; spread: number };

function pageFrames(from: Zone, to: Zone, same: boolean, spread: number): Keyframe[] {
  const { fx, fy, mx, my, tx, ty } = arc(from, to, spread);
  const at = (x: number, y: number, scale: number, opacity: number, blur: number): Keyframe => ({
    opacity,
    transform: `translate(${x}%, ${y}%) scale(${scale})`,
    filter: `blur(${blur}px)`,
  });
  if (same) {
    return [
      { offset: 0, ...at(fx, fy, 1, 1, 0) },
      { offset: 0.45, ...at(fx, fy, 0.62, 1, 0) },
      { offset: 1, ...at(0, 0, 1, 1, 0) },
    ];
  }
  return [
    { offset: 0, ...at(fx, fy, 0.16, 0, 10) },
    { offset: 0.2, ...at(fx, fy, 0.2, 1, 0) },
    { offset: 0.56, ...at(mx, my, 0.2, 1, 0) },
    { offset: 0.72, ...at(tx, ty, 0.22, 1, 0) },
    { offset: 1, ...at(0, 0, 1, 1, 0) },
  ];
}

function Atlas({ travel }: { travel: Travel }) {
  const { from, to, same, spread } = travel;
  const path = arc(from, to, spread);
  const mote = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = mote.current;
    if (!el || same) return;
    const anim = el.animate(
      [
        { offset: 0, opacity: 0, transform: `translate(${path.fx}%, ${path.fy}%)` },
        { offset: 0.2, opacity: 1, transform: `translate(${path.fx}%, ${path.fy}%)` },
        { offset: 0.56, opacity: 1, transform: `translate(${path.mx}%, ${path.my}%)` },
        { offset: 0.72, opacity: 1, transform: `translate(${path.tx}%, ${path.ty}%)` },
        { offset: 1, opacity: 0, transform: `translate(${path.tx}%, ${path.ty}%)` },
      ],
      { duration: 1600, easing: "linear", fill: "both" }
    );
    return () => anim.cancel();
  }, [path.fx, path.fy, path.mx, path.my, path.tx, path.ty, same]);

  const d = `M ${50 + path.fx} ${50 + path.fy} Q ${50 + path.mx} ${50 + path.my} ${50 + path.tx} ${50 + path.ty}`;

  return (
    <div
      className="atlas"
      style={{ ["--map-spread" as string]: String(spread), animationDuration: same ? "900ms" : "1600ms" }}
      aria-hidden
    >
      <svg className="atlas-sky" viewBox="0 0 100 100" preserveAspectRatio="none">
        {CONSTELLATIONS.map((group) => (
          <polyline
            key={group[0].id}
            className="atlas-constellation"
            points={group.map((z) => `${50 + z.x * spread},${50 + z.y * spread}`).join(" ")}
          />
        ))}
        {!same && <path className="atlas-route" d={d} />}
      </svg>
      {Object.values(ZONES).map((zone) => (
        <div
          key={zone.id}
          className={`atlas-node${zone.id === from.id ? " is-from" : ""}${zone.id === to.id ? " is-to" : ""}${zone.id === "home" ? " is-home" : ""}`}
          style={{
            ["--x" as string]: String(zone.x),
            ["--y" as string]: String(zone.y),
          }}
        >
          <i />
          <span>{zone.label}</span>
        </div>
      ))}
      {!same && (
        <div ref={mote} className="atlas-mote">
          <i />
        </div>
      )}
    </div>
  );
}

/**
 * Moves between pages by zooming out onto a map of the site,
 * panning along an arc, and zooming into the destination.
 */
export function RouteStage({ children }: { children: ReactNode }) {
  const location = useLocation();
  const locKey = placeKey(location.pathname, location.search);
  const prevKey = useRef(locKey);
  const pageRef = useRef<HTMLDivElement>(null);
  const [travel, setTravel] = useState<Travel | null>(null);

  if (locKey !== prevKey.current) {
    const from = zoneFor(prevKey.current);
    const to = zoneFor(locKey);
    prevKey.current = locKey;
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduce) {
      setTravel({ from, to, same: from.id === to.id, spread: mapSpread() });
    }
  }

  useEffect(() => {
    if (!travel) return;
    const el = pageRef.current;
    if (!el) return;
    const anim = el.animate(pageFrames(travel.from, travel.to, travel.same, travel.spread), {
      duration: travel.same ? 900 : 1600,
      easing: "linear",
      fill: "both",
    });
    let closed = false;
    const finish = () => {
      if (closed) return;
      closed = true;
      setTravel(null);
    };
    anim.onfinish = finish;
    return () => {
      closed = true;
      anim.cancel();
    };
  }, [travel]);

  const parked: CSSProperties | undefined = travel
    ? (() => {
        const frame = pageFrames(travel.from, travel.to, travel.same, travel.spread)[0];
        return {
          opacity: Number(frame.opacity ?? 1),
          transform: String(frame.transform ?? "none"),
          filter: String(frame.filter ?? "none"),
        };
      })()
    : undefined;

  return (
    <div className={`route-stage${travel ? " is-traveling" : ""}`}>
      {travel && <Atlas travel={travel} />}
      <div ref={pageRef} className="route-page" style={parked}>
        {children}
      </div>
    </div>
  );
}
