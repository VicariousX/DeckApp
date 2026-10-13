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

import { lockBodyScroll } from "../lib/scrollLock";
import { pushOverlay } from "../lib/overlayHistory";
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
export function TiltFace({
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
  onSwipeRight,
  onSwipeLeft,
  onLongPress,
  onSwipeUp,
  onSwipeDown,
  enterFrom,
  onEntered,
  nextSrc,
  prevSrc,
  keepOpenOnRight,
  rightLabel = "Open",
  leftLabel = "Dismiss",
  onToggleRight,
  toast,
  addedQty,
  onUndo,
  hint,
  mode = "tilt",
  embedded = false,
}: {
  frontSrc: string;
  backSrc?: string;
  frontName: string;
  backName?: string;
  multi?: boolean;
  initialFace?: 0 | 1;
  onClose: () => void;
  onActivate?: () => void;
  onSwipeRight?: () => void;
  onSwipeLeft?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  enterFrom?: "up" | "down" | null;
  onEntered?: () => void;
  nextSrc?: string;
  prevSrc?: string;
  keepOpenOnRight?: boolean;
  rightLabel?: string;
  leftLabel?: string;
  onLongPress?: () => void;
  onToggleRight?: () => void;
  toast?: string | null;
  addedQty?: number | null;
  onUndo?: () => void;
  hint?: string;
  /** tilt = pointer-tracked 3D (Enhance). swipe = left dismiss / right action. */
  mode?: "tilt" | "swipe";
  /** Render in place as the primary view instead of a pop-out overlay. */
  embedded?: boolean;
}) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const drag = useRef<{ x: number; y: number } | null>(null);
  const longPress = useRef(0);
  const [offset, setOffset] = useState(0);
  const [vOffset, setVOffset] = useState(0);
  const [axis, setAxis] = useState<"x" | "y" | null>(null);
  const [dragging, setDragging] = useState(false);
  const [settling, setSettling] = useState(false);
  const stackRef = useRef<HTMLDivElement>(null);
  const [face, setFace] = useState<0 | 1>(initialFace);
  const canFlip = Boolean(multi && backSrc);
  const swipe = mode === "swipe";

  useEffect(() => {
    if (embedded) {
      const unlock = lockBodyScroll();
      function onTouch(e: TouchEvent) {
        e.preventDefault();
      }
      window.addEventListener("touchmove", onTouch, { passive: false, capture: true });
      return () => {
        unlock();
        window.removeEventListener("touchmove", onTouch, true);
      };
    }
    const unlock = lockBodyScroll();
    const release = pushOverlay(() => closeRef.current());
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
      release();
      unlock();
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("wheel", onWheel, true);
      window.removeEventListener("touchmove", onTouch, true);
    };
  }, [canFlip, embedded]);

  useEffect(() => {
    if (enterFrom) {
      setSettling(true);
      setVOffset(enterFrom === "up" ? 160 : -160);
      window.setTimeout(() => {
        setSettling(false);
        setVOffset(0);
        onEntered?.();
      }, 30);
      return;
    }
    setOffset(0);
    setVOffset(0);
    setAxis(null);
  }, [frontSrc]);

  const src = face === 1 && backSrc ? backSrc : frontSrc;
  const alt = face === 1 ? backName || "Back" : frontName;

  const stage = (
    <div
      className={embedded ? styles.scrollView : styles.enlargeOverlay}
      onClick={embedded ? undefined : onClose}
      role={embedded ? undefined : "dialog"}
      aria-modal={embedded ? undefined : true}
      aria-label={alt}
      onPointerDown={swipe ? (e) => {
          drag.current = { x: e.clientX, y: e.clientY };
          setAxis(null);
          setOffset(0);
          setVOffset(0);
          setDragging(true);
          try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* ignore */ }
        } : undefined}
        onPointerMove={swipe ? (e) => {
          const start = drag.current;
          if (!start) return;
          const dx = e.clientX - start.x;
          const dy = e.clientY - start.y;
          if (Math.hypot(dx, dy) > 10 && longPress.current) {
            window.clearTimeout(longPress.current);
            longPress.current = 0;
          }
          if (!axis && Math.hypot(dx, dy) < 8) return;
          const next = axis ?? (Math.abs(dx) >= Math.abs(dy) ? "x" : "y");
          if (!axis) setAxis(next);
          if (next === "x") {
            setOffset(dx);
            setVOffset(0);
          } else {
            setVOffset(dy);
            setOffset(0);
          }
        } : undefined}
        onPointerUp={swipe ? (e) => {
          if (longPress.current) {
            window.clearTimeout(longPress.current);
            longPress.current = 0;
          }
          const start = drag.current;
          drag.current = null;
          setDragging(false);
          if (!start) return;
          const dx = e.clientX - start.x;
          const dy = e.clientY - start.y;
          if (Math.hypot(dx, dy) < 28) {
            onActivate?.();
            setAxis(null);
            setOffset(0);
            setVOffset(0);
            return;
          }
          const horizontal = Math.abs(dx) >= Math.abs(dy);
          if (horizontal && dx > 110) {
            if (keepOpenOnRight) {
              onSwipeRight?.();
              setAxis(null);
              setOffset(0);
            } else {
              setOffset(window.innerWidth);
              window.setTimeout(() => onSwipeRight?.(), 160);
            }
          } else if (horizontal && dx < -110) {
            onSwipeLeft?.();
            setAxis(null);
            setOffset(0);
          } else if (!horizontal && dy < -90 && (nextSrc || onSwipeUp)) {
            if (nextSrc) {
              const gap = (stackRef.current?.offsetHeight ?? 480) + 18;
              setVOffset(-gap);
              window.setTimeout(() => {
                setSettling(true);
                onSwipeUp?.();
                setAxis(null);
                setOffset(0);
                setVOffset(0);
                requestAnimationFrame(() => setSettling(false));
              }, 230);
            } else {
              onSwipeUp?.();
              setAxis(null);
              setOffset(0);
              setVOffset(0);
            }
          } else if (!horizontal && dy > 90 && (prevSrc || onSwipeDown)) {
            if (prevSrc) {
              const gap = (stackRef.current?.offsetHeight ?? 480) + 18;
              setVOffset(gap);
              window.setTimeout(() => {
                setSettling(true);
                onSwipeDown?.();
                setAxis(null);
                setOffset(0);
                setVOffset(0);
                requestAnimationFrame(() => setSettling(false));
              }, 230);
            } else {
              onSwipeDown?.();
              setAxis(null);
              setOffset(0);
              setVOffset(0);
            }
          } else {
            setAxis(null);
            setOffset(0);
            setVOffset(0);
          }
        } : undefined}
        onPointerCancel={swipe ? () => {
          drag.current = null;
          setDragging(false);
          setAxis(null);
          setOffset(0);
          setVOffset(0);
        } : undefined}
    >
      <div
        className={styles.enlargeStage}
        onClick={(e) => e.stopPropagation()}
      >
        {swipe ? (
          <div className={styles.swipeStack} ref={stackRef}>
            {prevSrc && (
              <div
                className={styles.swipeCard}
                style={{
                  transform: `translateY(calc(-100% - 18px + ${vOffset}px))`,
                  opacity: Math.min(1, Math.max(0, vOffset / 140)),
                  transition: dragging || settling ? "none" : "transform 0.23s ease, opacity 0.23s ease",
                }}
              >
                <img src={prevSrc} alt="" className={styles.enlargeImage} draggable={false} />
              </div>
            )}
            <div
              className={styles.swipeCard}
              style={{
                transform: `perspective(900px) translate(${offset}px, ${vOffset}px) rotateY(${offset / 16}deg)`,
                opacity: Math.max(0.35, 1 - Math.abs(offset) / 520),
                transition: dragging || settling ? "none" : "transform 0.23s ease, opacity 0.23s ease",
              }}
            >
              <img src={src} alt={alt} className={styles.enlargeImage} draggable={false} />
              {addedQty != null && addedQty > 0 && (
                <span key={addedQty} className={`${styles.qtyBadge} ${styles.qtyBadgeStay} ${styles.qtyBadgeFlash}`}>×{addedQty}</span>
              )}
              {toast && <span className={styles.addEmblem}>{toast}</span>}
            </div>
            {nextSrc && (
              <div
                className={styles.swipeCard}
                style={{
                  transform: `translateY(calc(100% + 18px + ${vOffset}px))`,
                  opacity: Math.min(1, Math.max(0, -vOffset / 140)),
                  transition: dragging || settling ? "none" : "transform 0.23s ease, opacity 0.23s ease",
                }}
              >
                <img src={nextSrc} alt="" className={styles.enlargeImage} draggable={false} />
              </div>
            )}
          </div>
        ) : (
          <TiltFace enabled onFaceClick={onActivate}>
            <img src={src} alt={alt} className={styles.enlargeImage} draggable={false} />
          </TiltFace>
        )}
        {swipe && (
          <>
            <span
              className={`${styles.swipeHint} ${styles.swipeHintLeft}`}
              style={{ opacity: Math.min(1, Math.max(0, -offset / 90)) }}
            >
              {leftLabel}
            </span>
            <span
              className={`${styles.swipeHint} ${styles.swipeHintRight}`}
              style={{ opacity: Math.min(1, Math.max(0, offset / 90)) }}
            >
              {rightLabel}
            </span>
            <div className={styles.swipeActions}>
              {onToggleRight && (
                <button type="button" className={styles.swipeToggle} onClick={onToggleRight}>
                  Right swipe: {rightLabel}
                </button>
              )}
            </div>
          </>
        )}
        <p className={styles.enlargeHint}>
          {hint ??
            (swipe
              ? "Swipe right to open · swipe left to dismiss"
              : canFlip
                ? "Scroll to flip · click outside to close"
                : "Click outside to close")}
        </p>
      </div>
    </div>
  );
  return embedded ? stage : createPortal(stage, document.body);
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
    const unlock = lockBodyScroll();
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
      unlock();
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
