import { useEffect, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { pushOverlayEntry } from "../lib/overlayManager";
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
  useEffect(() => {
    const release = pushOverlayEntry({
      type: "modal",
      close: onClose,
    });
    function onWheel(e: WheelEvent) {
      const t = e.target as HTMLElement | null;
      if (t?.closest("[data-modal-root]")) return;
      e.preventDefault();
    }
    function onTouch(e: TouchEvent) {
      const t = e.target as HTMLElement | null;
      if (t?.closest("[data-modal-root]")) return;
      e.preventDefault();
    }
    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("touchmove", onTouch, { passive: false });
    return () => {
      release();
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchmove", onTouch);
    };
  }, [onClose]);

  return createPortal(
    <div className={styles.overlay} onClick={onClose}>
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
