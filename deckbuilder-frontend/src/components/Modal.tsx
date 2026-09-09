import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import styles from "./Modal.module.css";


export function Modal({
  children,
  onClose
}: {
  children: ReactNode;
  onClose: () => void;
}) {
  return createPortal(
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <button className={styles.closeButton} onClick={onClose}>
          ✕
        </button>
        {children}
      </div>
    </div>,
    document.body
  );
}
