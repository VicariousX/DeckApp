import {
  useCallback,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
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
  overrideFrontSrc?: string;
  overrideBackSrc?: string;
  bothLayout?: "row" | "stack";
  /** 3D mouse-tracking tilt (modal / focus views). */
  tilt?: boolean;
  /** Hide F/B face badge (modal). */
  hideFaceBadge?: boolean;
};

type Tilt = { rx: number; ry: number; glareX: number; glareY: number };

/** Owns its own ref so parent never reads ref.current during render. */
function TiltFace({
  enabled,
  children,
  className,
}: {
  enabled: boolean;
  children: ReactNode;
  className?: string;
}) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [tilt, setTilt] = useState<Tilt | null>(null);

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!enabled) return;
      const el = frameRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      if (rect.width < 8 || rect.height < 8) return;
      const px = (e.clientX - rect.left) / rect.width;
      const py = (e.clientY - rect.top) / rect.height;
      const x = px * 2 - 1;
      const y = py * 2 - 1;
      setTilt({
        rx: -(y * 12),
        ry: x * 15,
        glareX: px * 100,
        glareY: py * 100,
      });
    },
    [enabled]
  );

  const onPointerLeave = useCallback(() => {
    if (!enabled) return;
    setTilt(null);
  }, [enabled]);

  const style: CSSProperties | undefined = enabled
    ? tilt
      ? {
          transform: `perspective(900px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg) scale3d(1.04, 1.04, 1.04)`,
          ["--glare-x" as string]: `${tilt.glareX}%`,
          ["--glare-y" as string]: `${tilt.glareY}%`,
        }
      : {
          transform:
            "perspective(900px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)",
        }
    : undefined;

  const cls = [
    styles.faceObject,
    enabled ? styles.frameTilt : "",
    tilt ? styles.frameTiltActive : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      ref={frameRef}
      className={cls}
      style={style}
      onPointerMove={enabled ? onPointerMove : undefined}
      onPointerLeave={enabled ? onPointerLeave : undefined}
    >
      {enabled && <div className={styles.tiltGlare} aria-hidden />}
      {children}
    </div>
  );
}

export function CardImage({
  card,
  className,
  onActivate,
  onViewChange,
  overrideFrontSrc,
  overrideBackSrc,
  bothLayout = "row",
  tilt = false,
  hideFaceBadge = false,
}: CardImageProps) {
  const multi = isMultiCard(card);
  const faces = getFaces(card);
  const defaultView: CardFaceView =
    bothLayout === "stack" && multi ? "both" : "front";
  const [userView, setUserView] = useState<CardFaceView | null>(null);
  const view = userView ?? defaultView;

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

  const shellClass = [
    styles.frame,
    multi ? styles.frameMulti : "",
    view === "both" ? styles.frameBoth : "",
    view === "both" && bothLayout === "stack" ? styles.frameBothStack : "",
    bothLayout === "stack" ? styles.frameStackTall : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  const bothClass =
    bothLayout === "stack" ? `${styles.both} ${styles.bothStack}` : styles.both;

  return (
    <div
      className={shellClass}
      onClick={() => onActivate?.(card)}
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
      {view === "both" && multi ? (
        <div className={bothClass}>
          <TiltFace enabled={tilt}>
            <img
              key={`f-${frontSrc}`}
              src={frontSrc}
              alt={frontName}
              className={styles.imageHalf}
              draggable={false}
            />
          </TiltFace>
          <TiltFace enabled={tilt}>
            <img
              key={`b-${backSrc}`}
              src={backSrc}
              alt={backName}
              className={styles.imageHalf}
              draggable={false}
            />
          </TiltFace>
        </div>
      ) : (
        <TiltFace enabled={tilt}>
          <img
            key={view === "back" && multi ? `b-${backSrc}` : `f-${frontSrc}`}
            src={view === "back" && multi ? backSrc : frontSrc}
            alt={view === "back" && multi ? backName : frontName}
            className={styles.image}
            draggable={false}
          />
          {multi && view !== "both" && !hideFaceBadge && (
            <span className={styles.faceBadge} aria-hidden>
              {view === "back" ? "B" : "F"}
            </span>
          )}
        </TiltFace>
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
