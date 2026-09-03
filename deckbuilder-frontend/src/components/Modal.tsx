import { ReactNode } from "react";

import styles from "./Modal.module.css";


export function Modal({
  children,
  onClose
}: {
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className={styles["modalOverlay"]} onClick={onClose}>
      <div
        className={styles["modalContent"]}
        onClick={(e) => e.stopPropagation()}
      >
        <button className={styles["modalClose"]} onClick={onClose}>
          ✕
        </button>
        {children}
      </div>
    </div>
  );
}
