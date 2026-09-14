import {
  useCallback,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

import type { ScryfallCard } from "../types/scryfallCard";
import {
  getFaceImage,
  getFaces,
  isMultiCard,
} from "../utils/scryfall";

import styles from "./CardImage.module.css";

export type CardFaceView = "front" | "back" | "both";

type CardImageProps = {
  card: ScryfallCard;
  className?: string;
  onActivate?: (card: ScryfallCard) => void;
  onViewChange?: (view: CardFaceView) => void;
  /** Preferred / custom art for the front face (e.g. user choice). */
  overrideFrontSrc?: string;
  /** Preferred / custom art for the back face when multi-faced. */
  overrideBackSrc?: string;
  /**
   * How to lay out “both” faces.
   * - row: side-by-side (search results)
   * - stack: front above back (deck builder modal)
   */
  bothLayout?: "row" | "stack";
  /** 3D mouse-tracking tilt (modal / focus views). */
  tilt?: boolean;
};

type Tilt = { rx: number; ry: number; glareX: number; glareY: number };

export function CardImage({
  card,
  className,
  onActivate,
  onViewChange,
  overrideFrontSrc,
  overrideBackSrc,
  bothLayout = "row",
  tilt = false,
}: CardImageProps) {
  const multi = isMultiCard(card);
  const faces = getFaces(card);
  const defaultView: CardFaceView =
    bothLayout === "stack" && multi ? "both" : "front";
  // null = follow default for current card/layout (no effect-based reset)
  const [userView, setUserView] = useState<CardFaceView | null>(null);
  const view = userView ?? defaultView;

  const [tiltState, setTiltState] = useState<Tilt | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);

  // Preferred printing card supplies both faces; overrides apply per face when set.
  const frontSrc = overrideFrontSrc || getFaceImage(card, 0);
  const backSrc = multi
    ? overrideBackSrc || getFaceImage(card, 1) || ""
    : "";

  const frontName = faces[0]?.name ?? card.name;
  const backName = faces[1]?.name ?? "Back";

  function setView(next: CardFaceView | ((prev: CardFaceView) => CardFaceView)) {
    setUserView((prev) => {
      const current = prev ?? defaultView;
      const resolved = typeof next === "function" ? next(current) : next;
      onViewChange?.(resolved);
      return resolved;
    });
  }

  function stop(e: ReactMouseEvent) {
    e.stopPropagation();
    e.preventDefault();
  }

  function cycleFlip(e: ReactMouseEvent) {
    stop(e);
    setView((v) => (v === "back" ? "front" : "back"));
  }

  function toggleBoth(e: ReactMouseEvent) {
    stop(e);
    setView((v) => (v === "both" ? "front" : "both"));
  }

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!tilt) return;
      const el = frameRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      if (rect.width < 8 || rect.height < 8) return;
      const px = (e.clientX - rect.left) / rect.width;
      const py = (e.clientY - rect.top) / rect.height;
      const x = px * 2 - 1;
      const y = py * 2 - 1;
      // Subtle tangible pop — stronger near edges
      setTiltState({
        rx: -(y * 11),
        ry: x * 14,
        glareX: px * 100,
        glareY: py * 100,
      });
    },
    [tilt]
  );

  const onPointerLeave = useCallback(() => {
    if (!tilt) return;
    setTiltState(null);
  }, [tilt]);

  const frameClass = [
    styles.frame,
    multi ? styles.frameMulti : "",
    view === "both" ? styles.frameBoth : "",
    view === "both" && bothLayout === "stack" ? styles.frameBothStack : "",
    bothLayout === "stack" ? styles.frameStackTall : "",
    tilt ? styles.frameTilt : "",
    tiltState ? styles.frameTiltActive : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  const bothClass =
    bothLayout === "stack" ? `${styles.both} ${styles.bothStack}` : styles.both;

  const tiltStyle: CSSProperties | undefined =
    tilt && tiltState
      ? {
          transform: `perspective(900px) rotateX(${tiltState.rx}deg) rotateY(${tiltState.ry}deg) scale3d(1.03, 1.03, 1.03)`,
          ["--glare-x" as string]: `${tiltState.glareX}%`,
          ["--glare-y" as string]: `${tiltState.glareY}%`,
        }
      : tilt
        ? {
            transform: "perspective(900px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)",
          }
        : undefined;

  return (
    <div
      ref={frameRef}
      className={frameClass}
      style={tiltStyle}
      onClick={() => onActivate?.(card)}
      onPointerMove={tilt ? onPointerMove : undefined}
      onPointerLeave={tilt ? onPointerLeave : undefined}
      role={onActivate ? "button" : undefined}
      tabIndex={onActivate ? 0 : undefined}
      onKeyDown={
        onActivate
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onActivate(card);
              }
            }
          : undefined
      }
    >
      {tilt && <div className={styles.tiltGlare} aria-hidden />}

      {view === "both" && multi ? (
        <div className={bothClass}>
          <img
            key={`f-${frontSrc}`}
            src={frontSrc}
            alt={frontName}
            className={styles.imageHalf}
            draggable={false}
          />
          <img
            key={`b-${backSrc}`}
            src={backSrc}
            alt={backName}
            className={styles.imageHalf}
            draggable={false}
          />
        </div>
      ) : (
        <>
          <img
            key={view === "back" && multi ? `b-${backSrc}` : `f-${frontSrc}`}
            src={view === "back" && multi ? backSrc : frontSrc}
            alt={view === "back" && multi ? backName : frontName}
            className={styles.image}
            draggable={false}
          />
          {multi && view !== "both" && (
            <span className={styles.faceBadge} aria-hidden>
              {view === "back" ? "B" : "F"}
            </span>
          )}
        </>
      )}

      {multi && (
        <div className={styles.controls}>
          <button
            type="button"
            className={`${styles.controlBtn}${
              view === "back" ? ` ${styles.controlBtnActive}` : ""
            }`}
            onClick={cycleFlip}
          >
            Flip
          </button>
          <button
            type="button"
            className={`${styles.controlBtn}${
              view === "both" ? ` ${styles.controlBtnActive}` : ""
            }`}
            onClick={toggleBoth}
          >
            Both
          </button>
        </div>
      )}
    </div>
  );
}
