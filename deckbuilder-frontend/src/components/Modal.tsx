import type { CSSProperties, ReactNode } from "react";
import { createPortal } from "react-dom";
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
  return createPortal(
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={styles.modal}
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
