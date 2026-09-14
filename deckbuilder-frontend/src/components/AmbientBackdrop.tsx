import { useEffect, useRef } from "react";
import styles from "./AmbientBackdrop.module.css";

/**
 * Fixed atmospheric layers that drift subtly with scroll.
 * Uses CSS variables driven by --scroll-y for low-cost parallax.
 */
export function AmbientBackdrop() {
  const raf = useRef<number | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    let last = -1;

    function tick() {
      const y = window.scrollY || 0;
      if (Math.abs(y - last) >= 0.5) {
        // Normalize into a gentle range for CSS (0–1 over ~1200px)
        const t = Math.min(1, y / 1200);
        root.style.setProperty("--scroll-y", String(y));
        root.style.setProperty("--scroll-t", t.toFixed(4));
        last = y;
      }
      raf.current = requestAnimationFrame(tick);
    }

    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current != null) cancelAnimationFrame(raf.current);
    };
  }, []);

  return (
    <div className={styles.root} aria-hidden>
      <div className={styles.glowA} />
      <div className={styles.glowB} />
      <div className={styles.haze} />
      <div className={styles.vignette} />
    </div>
  );
}
