import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import styles from "./CardLightbox.module.css";
import { peekNextZ, pushOverlayEntry } from "../lib/overlayManager";

type Props = {
  src: string;
  alt: string;
  onClose: () => void;
};

/** Full-screen centered card image; click outside or press Escape to close. */
export function CardLightbox({ src, alt, onClose }: Props) {
  const [zIndex, setZIndex] = useState(() => peekNextZ());
  useEffect(() => {
    const handle = pushOverlayEntry({
      type: "lightbox",
      close: onClose,
    });
    setZIndex(handle.zIndex);
    return () => {
      handle.release();
    };
  }, [onClose]);

  return createPortal(
    <div
      className={styles.overlay}
      style={{ zIndex }}
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
