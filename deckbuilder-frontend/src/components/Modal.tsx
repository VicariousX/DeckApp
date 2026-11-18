import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { peekNextZ, pushOverlayEntry } from "../lib/overlayManager";
import styles from "./Modal.module.css";

export function Modal({
  children,
  onClose,
  hideClose = false,
  style,
}: {
  children: ReactNode;
  onClose: () => void;
  /** Hide the corner × (overlay click / Esc still close when wired by parent). */
  hideClose?: boolean;
  style?: CSSProperties;
}) {
  const [zIndex, setZIndex] = useState(() => peekNextZ());

  useEffect(() => {
    const handle = pushOverlayEntry({
      type: "modal",
      close: onClose,
    });
    setZIndex(handle.zIndex);
    const html = document.documentElement;
    const body = document.body;
    const scrollY = window.scrollY;
    html.setAttribute("data-scroll-lock", "");
    const prev = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      overflow: body.style.overflow,
      overscroll: body.style.overscrollBehavior,
    };
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    body.style.overflow = "hidden";
    body.style.overscrollBehavior = "none";

    let lastY = 0;
    function onStart(e: TouchEvent) {
      lastY = e.touches[0]?.clientY ?? 0;
    }
    function canConsume(el: HTMLElement, delta: number) {
      const oy = window.getComputedStyle(el).overflowY;
      if (oy !== "auto" && oy !== "scroll" && oy !== "overlay") return false;
      if (el.scrollHeight <= el.clientHeight + 1) return false;
      if (delta > 0 && el.scrollTop <= 0) return false;
      if (delta < 0 && el.scrollTop + el.clientHeight >= el.scrollHeight - 1) return false;
      return true;
    }
    function onTouch(e: TouchEvent) {
      const y = e.touches[0]?.clientY ?? lastY;
      const delta = y - lastY;
      lastY = y;
      const t = e.target as HTMLElement | null;
      if (!t?.closest("[data-modal-root]")) {
        e.preventDefault();
        return;
      }
      let el: HTMLElement | null = t;
      while (el && !el.hasAttribute("data-modal-root")) {
        if (canConsume(el, delta)) return;
        el = el.parentElement;
      }
      e.preventDefault();
    }
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onTouch, { passive: false });
    return () => {
      handle.release();
      html.removeAttribute("data-scroll-lock");
      body.style.position = prev.position;
      body.style.top = prev.top;
      body.style.left = prev.left;
      body.style.right = prev.right;
      body.style.width = prev.width;
      body.style.overflow = prev.overflow;
      body.style.overscrollBehavior = prev.overscroll;
      window.scrollTo(0, scrollY);
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onTouch);
    };
  }, [onClose]);

  return createPortal(
    <div className={styles.overlay} style={{ zIndex }} onClick={onClose}>
      <div
        className={styles.modal}
        data-modal-root
        style={style}
        onClick={(e) => e.stopPropagation()}
      >
        {!hideClose && (
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        )}
        {children}
      </div>
    </div>,
    document.body
  );
}