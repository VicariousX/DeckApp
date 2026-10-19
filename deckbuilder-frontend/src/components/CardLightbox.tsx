import { useEffect } from "react";
import { createPortal } from "react-dom";
import styles from "./CardLightbox.module.css";
import { pushOverlayEntry } from "../lib/overlayManager";

type Props = {
  src: string;
  alt: string;
  onClose: () => void;
};

/** Full-screen centered card image; click outside or press Escape to close. */
export function CardLightbox({ src, alt, onClose }: Props) {
  useEffect(() => {
    const release = pushOverlayEntry({
      type: "lightbox",
      close: onClose,
    });
    return () => {
      release();
    };
  }, [onClose]);

  return createPortal(
    <div
      className={styles.overlay}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={alt}
    >
      <button
        type="button"
        className={styles.close}
        onClick={onClose}
        aria-label="Close"
      >
        ✕
      </button>
      <img
        src={src}
        alt={alt}
        className={styles.image}
        onClick={(e) => e.stopPropagation()}
        draggable={false}
      />
    </div>,
    document.body
  );
}
