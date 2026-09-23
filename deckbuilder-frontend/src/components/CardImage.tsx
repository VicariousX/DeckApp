import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type DragEvent as ReactDragEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import type { ScryfallCard } from "../types/scryfallCard";
import { startExternalCardDrag } from "../lib/cardDrag";
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
  /** Hide Flip / Both controls (modal always-both). */
  hideControls?: boolean;
  /** HTML5 drag payload for Scryfall/Archidekt-style drops. Default on. */
  exportDrag?: boolean;
};

type Tilt = { rx: number; ry: number; glareX: number; glareY: number };

/** Owns its own ref so parent never reads ref.current during render. */
function TiltFace({
  enabled,
  children,
  className,
  onFaceClick,
}: {
  enabled: boolean;
  children: ReactNode;
  className?: string;
  onFaceClick?: () => void;
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
          transform: `perspective(900px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg) scale3d(1.05, 1.05, 1.05)`,
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
      onClick={
        onFaceClick
          ? (e) => {
              e.stopPropagation();
              onFaceClick();
            }
          : undefined
      }
      role={onFaceClick ? "button" : undefined}
    >
      {enabled && <div className={styles.tiltGlare} aria-hidden />}
      {children}
    </div>
  );
}

function FaceSlot({ children }: { children: ReactNode }) {
  return <div className={styles.faceSlot}>{children}</div>;
}

export function CardEnlargeOverlay({
  frontSrc,
  backSrc,
  frontName,
  backName,
  multi,
  initialFace = 0,
  onClose,
  onActivate,
  hint,
}: {
  frontSrc: string;
  backSrc?: string;
  frontName: string;
  backName?: string;
  multi?: boolean;
  initialFace?: 0 | 1;
  onClose: () => void;
  onActivate?: () => void;
  hint?: string;
}) {
  const [face, setFace] = useState<0 | 1>(initialFace);
  const canFlip = Boolean(multi && backSrc);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        e.preventDefault();
        onClose();
      }
    }
    let flipLock = false;
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      e.stopPropagation();
      if (!canFlip) return;
      if (Math.abs(e.deltaY) < 8 && Math.abs(e.deltaX) < 8) return;
      if (flipLock) return;
      flipLock = true;
      setFace((f) => (f === 0 ? 1 : 0));
      window.setTimeout(() => {
        flipLock = false;
      }, 280);
    }
    function onTouch(e: TouchEvent) {
      e.preventDefault();
    }
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("wheel", onWheel, { passive: false, capture: true });
    window.addEventListener("touchmove", onTouch, { passive: false, capture: true });
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("wheel", onWheel, true);
      window.removeEventListener("touchmove", onTouch, true);
    };
  }, [canFlip, onClose]);

  const src = face === 1 && backSrc ? backSrc : frontSrc;
  const alt = face === 1 ? backName || "Back" : frontName;

  return createPortal(
    <div
      className={styles.enlargeOverlay}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={alt}
    >
      <div
        className={styles.enlargeStage}
        onClick={(e) => e.stopPropagation()}
      >
        <TiltFace enabled onFaceClick={onActivate}>
          <img src={src} alt={alt} className={styles.enlargeImage} draggable={false} />
        </TiltFace>
        <p className={styles.enlargeHint}>
          {hint ??
            (canFlip
              ? "Scroll to flip · click outside to close"
              : "Click outside to close")}
        </p>
      </div>
    </div>,
    document.body
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
  hideControls = false,
  exportDrag = true,
}: CardImageProps) {
  const multi = isMultiCard(card);
  const faces = getFaces(card);
  const defaultView: CardFaceView =
    (hideControls || bothLayout === "stack") && multi ? "both" : "front";
  const [userView, setUserView] = useState<CardFaceView | null>(null);
  const view = userView ?? defaultView;
  const [enlarged, setEnlarged] = useState<{
    face: 0 | 1;
  } | null>(null);

  const frontSrc = overrideFrontSrc || getFaceImage(card, 0);
  const backSrc = multi
    ? overrideBackSrc || getFaceImage(card, 1) || ""
    : "";

  useEffect(() => {
    if (!enlarged) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        e.preventDefault();
        setEnlarged(null);
      }
    }
    let flipLock = false;
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      e.stopPropagation();
      if (!multi || !backSrc) return;
      if (Math.abs(e.deltaY) < 8 && Math.abs(e.deltaX) < 8) return;
      if (flipLock) return;
      flipLock = true;
      setEnlarged((cur) => (cur ? { face: cur.face === 0 ? 1 : 0 } : cur));
      window.setTimeout(() => {
        flipLock = false;
      }, 280);
    }
    function onTouch(e: TouchEvent) {
      e.preventDefault();
    }
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("wheel", onWheel, { passive: false, capture: true });
    window.addEventListener("touchmove", onTouch, { passive: false, capture: true });
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("wheel", onWheel, true);
      window.removeEventListener("touchmove", onTouch, true);
    };
  }, [enlarged, multi, backSrc]);

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

  const showBoth = view === "both" && multi;
  const showBackOnly = view === "back" && multi;

  const shellClass = [
    styles.frame,
    multi ? styles.frameMulti : "",
    showBoth ? styles.frameBoth : "",
    showBoth && bothLayout === "stack" ? styles.frameBothStack : "",
    tilt ? styles.frameModalSlots : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  const bothClass =
    bothLayout === "stack" ? `${styles.both} ${styles.bothStack}` : styles.both;

  return (
    <div
      className={shellClass}
      draggable={exportDrag}
      onDragStart={
        exportDrag
          ? (e: ReactDragEvent) => {
              startExternalCardDrag(e, card);
            }
          : undefined
      }
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
      {showBoth ? (
        <div className={bothClass}>
          <FaceSlot>
            <TiltFace
              enabled={tilt}
              onFaceClick={
                tilt ? () => setEnlarged({ face: 0 }) : undefined
              }
            >
              <img
                key={`f-${frontSrc}`}
                src={frontSrc}
                alt={frontName}
                className={styles.imageHalf}
                draggable={false}
              />
            </TiltFace>
          </FaceSlot>
          <FaceSlot>
            <TiltFace
              enabled={tilt}
              onFaceClick={
                tilt ? () => setEnlarged({ face: 1 }) : undefined
              }
            >
              <img
                key={`b-${backSrc}`}
                src={backSrc}
                alt={backName}
                className={styles.imageHalf}
                draggable={false}
              />
            </TiltFace>
          </FaceSlot>
        </div>
      ) : (
        <FaceSlot>
          <TiltFace
            enabled={tilt}
            onFaceClick={
              tilt
                ? () =>
                    setEnlarged({
                      face: showBackOnly ? 1 : 0,
                    })
                : undefined
            }
          >
            <img
              key={showBackOnly ? `b-${backSrc}` : `f-${frontSrc}`}
              src={showBackOnly ? backSrc : frontSrc}
              alt={showBackOnly ? backName : frontName}
              className={styles.image}
              draggable={false}
            />
            {multi && !hideFaceBadge && (
              <span className={styles.faceBadge} aria-hidden>
                {showBackOnly ? "B" : "F"}
              </span>
            )}
          </TiltFace>
        </FaceSlot>
      )}

      {multi && !hideControls && (
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

      {enlarged && (
        <CardEnlargeOverlay
          frontSrc={frontSrc}
          backSrc={backSrc}
          frontName={frontName}
          backName={backName}
          multi={multi}
          initialFace={enlarged.face}
          onClose={() => setEnlarged(null)}
        />
      )}
    </div>
  );
}
