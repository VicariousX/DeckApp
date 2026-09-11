import { useEffect } from "react";
import { createPortal } from "react-dom";
import styles from "./CardLightbox.module.css";

type Props = {
  src: string;
  alt: string;
  onClose: () => void;
};

/** Full-screen centered card image; click outside or press Escape to close. */
export function CardLightbox({ src, alt, onClose }: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
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
