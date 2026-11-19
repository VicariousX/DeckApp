import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { arc, CONSTELLATIONS, mapSpread, placeKey, ZONES, zoneFor, zoneLift, type Zone } from "./siteMap";

type Travel = {
  from: Zone;
  to: Zone;
  same: boolean;
  spread: number;
  tilt: number;
  range: number;
  ms: number;
};

function profile(): Pick<Travel, "spread" | "tilt" | "range" | "ms"> {
  const mobile = typeof window !== "undefined" && window.matchMedia("(max-width: 720px)").matches;
  return mobile
    ? { spread: mapSpread(), tilt: 32, range: 980, ms: 1250 }
    : { spread: 1, tilt: 52, range: 1500, ms: 1700 };
}

function pose(x: number, y: number, tilt: number, range: number, heading = 0) {
  return `translateZ(${-range}px) rotateX(${tilt}deg) rotateZ(${heading}deg) translate(${-x}%, ${-y}%)`;
}

function rigFrames(travel: Travel): Keyframe[] {
  const { fx, fy, mx, my, tx, ty } = arc(travel.from, travel.to, travel.spread);
  const { tilt, range, same } = travel;
  if (same) {
    return [
      { offset: 0, transform: pose(fx, fy, tilt * 0.45, range * 0.45) },
      { offset: 0.48, transform: pose(fx, fy, tilt * 0.7, range * 0.72) },
      { offset: 1, transform: pose(tx, ty, 0, 0) },
    ];
  }
  const heading = Math.max(-8, Math.min(8, (tx - fx) * -0.18));
  return [
    { offset: 0, transform: pose(fx, fy, tilt, range) },
    { offset: 0.2, transform: pose(fx, fy, tilt, range * 1.04) },
    { offset: 0.6, transform: pose(mx, my, tilt * 0.9, range * 1.06, heading) },
    { offset: 0.78, transform: pose(tx, ty, tilt * 0.55, range * 0.55) },
    { offset: 1, transform: pose(tx, ty, 0, 0) },
  ];
}

function cardFrames(same: boolean): Keyframe[] {
  const at = (scale: number, radius: string): Keyframe => ({
    transform: `translate(-50%, -50%) scale(${scale})`,
    borderRadius: radius,
  });
  if (same) {
    return [
      { offset: 0, ...at(1, "0px") },
      { offset: 0.48, ...at(0.62, "18px") },
      { offset: 1, ...at(1, "0px") },
    ];
  }
  return [
    { offset: 0, ...at(0.15, "18px") },
    { offset: 0.72, ...at(0.18, "18px") },
    { offset: 1, ...at(1, "0px") },
  ];
}

function Flight({ travel, children }: { travel: Travel; children: ReactNode }) {
  const rigRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const path = arc(travel.from, travel.to, travel.spread);
  const rigStart = rigFrames(travel)[0]?.transform;
  const cardStart = cardFrames(travel.same)[0]?.transform;

  useEffect(() => {
    const rig = rigRef.current;
    const card = cardRef.current;
    if (!rig || !card) return;
    const opts: KeyframeAnimationOptions = {
      duration: travel.same ? 1000 : travel.ms,
      easing: "linear",
      fill: "both",
    };
    const rigAnim = rig.animate(rigFrames(travel), opts);
    const cardAnim = card.animate(cardFrames(travel.same), opts);
    return () => {
      rigAnim.cancel();
      cardAnim.cancel();
    };
  }, [travel]);

  return (
    <div className="flight-rig" ref={rigRef} style={{ transform: String(rigStart ?? "none") }}>
      <div className="flight-board">
        <div className="flight-ground" />
        <svg className="flight-sky" viewBox="0 0 100 100" preserveAspectRatio="none">
          {CONSTELLATIONS.map((group) => (
            <polyline
              key={group[0].id}
              className="flight-line"
              points={group.map((z) => `${50 + z.x * travel.spread},${50 + z.y * travel.spread}`).join(" ")}
            />
          ))}
          {!travel.same && (
            <path
              className="flight-route"
              d={`M ${50 + path.fx} ${50 + path.fy} Q ${50 + path.mx} ${50 + path.my} ${50 + path.tx} ${50 + path.ty}`}
            />
          )}
        </svg>
        {Object.values(ZONES).map((zone) =>
          zone.id === travel.to.id ? null : (
            <div
              key={zone.id}
              className={`flight-plinth${zone.id === travel.from.id ? " is-from" : ""}`}
              style={
                {
                  ["--x" as string]: String(zone.x * travel.spread),
                  ["--y" as string]: String(zone.y * travel.spread),
                  ["--lift" as string]: `${zoneLift(zone.id) * travel.spread}px`,
                } as CSSProperties
              }
            >
              <i />
              <span>{zone.label}</span>
            </div>
          )
        )}
        <div
          ref={cardRef}
          className="flight-card"
          style={
            {
              ["--x" as string]: String(travel.to.x * travel.spread),
              ["--y" as string]: String(travel.to.y * travel.spread),
              transform: String(cardStart ?? "none"),
            } as CSSProperties
          }
        >
          {children}
        </div>
      </div>
    </div>
  );
}

/**
 * Page changes fly a camera over a tilted map of the site,
 * then level out on the destination.
 */
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
      setTravel({ from, to, same: from.id === to.id, ...profile() });
    }
  }

  useEffect(() => {
    if (!travel) return;
    const ms = travel.same ? 1000 : travel.ms;
    const timer = window.setTimeout(() => setTravel(null), ms + 40);
    return () => window.clearTimeout(timer);
  }, [travel]);

  useEffect(() => {
    if (!fade) return;
    const timer = window.setTimeout(() => setFade(false), 320);
    return () => window.clearTimeout(timer);
  }, [fade]);

  return (
    <div className={`route-stage${travel ? " is-traveling" : ""}${fade ? " is-fading" : ""}`}>
      {travel ? (
        <Flight travel={travel}>{children}</Flight>
      ) : (
        <div className="route-page">{children}</div>
      )}
    </div>
  );
}
