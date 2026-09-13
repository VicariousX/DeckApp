import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";

type Pos = { x: number; y: number };

/**
 * Drag a floating panel by a handle. Position tracks the pointer using
 * grab-offset (click point within the panel), not just panel top-left delta.
 */
export function useDraggablePanel(open: boolean) {
  const [offset, setOffset] = useState<Pos | null>(null);
  const dragging = useRef(false);
  /** Cursor offset inside the panel at drag start */
  const grab = useRef<{ gx: number; gy: number } | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) {
      setOffset(null);
      grab.current = null;
      dragging.current = false;
    }
  }, [open]);

  const onHandlePointerDown = useCallback((e: ReactPointerEvent) => {
    if (e.button !== 0) return;
    const el = panelRef.current;
    if (!el) return;
    e.preventDefault();
    e.stopPropagation();
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    const rect = el.getBoundingClientRect();
    // Where inside the panel the user grabbed
    grab.current = {
      gx: e.clientX - rect.left,
      gy: e.clientY - rect.top,
    };
    // Pin to current screen position immediately (before drag moves)
    setOffset({ x: rect.left, y: rect.top });
    dragging.current = true;
  }, []);

  useEffect(() => {
    function onMove(e: PointerEvent) {
      if (!dragging.current || !grab.current) return;
      const w = panelRef.current?.offsetWidth ?? 320;
      let x = e.clientX - grab.current.gx;
      let y = e.clientY - grab.current.gy;
      x = Math.min(Math.max(8, x), window.innerWidth - Math.min(w, 80));
      y = Math.min(Math.max(8, y), window.innerHeight - 48);
      setOffset({ x, y });
    }
    function onUp() {
      dragging.current = false;
      grab.current = null;
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, []);

  const panelStyle: CSSProperties | undefined = offset
    ? {
        position: "fixed",
        left: offset.x,
        top: offset.y,
        right: "auto",
        bottom: "auto",
        margin: 0,
        zIndex: 60,
      }
    : undefined;

  return {
    panelRef,
    panelStyle,
    onHandlePointerDown,
    isFloating: offset !== null,
  };
}
