import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import styles from "./BottomSheet.module.css";
import { pushOverlayEntry } from "../lib/overlayManager";

type Props = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  /** Optional extra class on the sheet body */
  bodyClassName?: string;
};

/**
 * Mobile bottom sheet. Renders via portal, locks body scroll,
 * closes on overlay click or Escape. Drag handle is visual only
 * (close is via the × button or overlay).
 */
export function BottomSheet({
  open,
  onClose,
  title,
  children,
  bodyClassName,
}: Props) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const release = pushOverlayEntry({
      type: "sheet",
      close: () => closeRef.current(),
    });

    return () => {
      release();
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.handle} aria-hidden>
          <div className={styles.handleBar} />
        </div>
        <header className={styles.header}>
          {title ? <h2 className={styles.title}>{title}</h2> : <span className={styles.title} />}
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </header>
        <div className={`${styles.body}${bodyClassName ? ` ${bodyClassName}` : ""}`}>
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}
