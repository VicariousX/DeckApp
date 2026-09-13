import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";

type Pos = { x: number; y: number };
type Size = { w: number; h: number };

/**
 * Floating panel: drag from handle only; optional resize from edges.
 * Click targets with data-no-drag are ignored (close, links, etc.).
 */
export function useDraggablePanel(open: boolean) {
  const [offset, setOffset] = useState<Pos | null>(null);
  const [size, setSize] = useState<Size | null>(null);
  const dragging = useRef(false);
  const resizing = useRef<null | { dir: string; startX: number; startY: number; startW: number; startH: number; startLeft: number; startTop: number }>(null);
  const grab = useRef<{ gx: number; gy: number } | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) {
      setOffset(null);
      setSize(null);
      grab.current = null;
      dragging.current = false;
      resizing.current = null;
    }
  }, [open]);

  const onHandlePointerDown = useCallback((e: ReactPointerEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest("[data-no-drag]")) return;
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
    // Use fixed coordinates from the live layout box
    grab.current = {
      gx: e.clientX - rect.left,
      gy: e.clientY - rect.top,
    };
    setOffset({ x: rect.left, y: rect.top });
    if (!size) {
      setSize({ w: rect.width, h: rect.height });
    }
    dragging.current = true;
  }, [size]);

  const onResizePointerDown = useCallback(
    (dir: string) => (e: ReactPointerEvent) => {
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
      if (!offset) setOffset({ x: rect.left, y: rect.top });
      const w = size?.w ?? rect.width;
      const h = size?.h ?? rect.height;
      setSize({ w, h });
      resizing.current = {
        dir,
        startX: e.clientX,
        startY: e.clientY,
        startW: w,
        startH: h,
        startLeft: offset?.x ?? rect.left,
        startTop: offset?.y ?? rect.top,
      };
    },
    [offset, size]
  );

  useEffect(() => {
    function onMove(e: PointerEvent) {
      if (resizing.current) {
        const r = resizing.current;
        const dx = e.clientX - r.startX;
        const dy = e.clientY - r.startY;
        let w = r.startW;
        let h = r.startH;
        let left = r.startLeft;
        let top = r.startTop;
        const minW = 280;
        const minH = 220;
        if (r.dir.includes("e")) w = Math.max(minW, r.startW + dx);
        if (r.dir.includes("s")) h = Math.max(minH, r.startH + dy);
        if (r.dir.includes("w")) {
          w = Math.max(minW, r.startW - dx);
          left = r.startLeft + (r.startW - w);
        }
        if (r.dir.includes("n")) {
          h = Math.max(minH, r.startH - dy);
          top = r.startTop + (r.startH - h);
        }
        setSize({ w, h });
        setOffset({ x: left, y: top });
        return;
      }
      if (!dragging.current || !grab.current) return;
      const w = size?.w ?? panelRef.current?.offsetWidth ?? 320;
      let x = e.clientX - grab.current.gx;
      let y = e.clientY - grab.current.gy;
      x = Math.min(Math.max(0, x), window.innerWidth - Math.min(w, 80));
      y = Math.min(Math.max(0, y), window.innerHeight - 48);
      setOffset({ x, y });
    }
    function onUp() {
      dragging.current = false;
      grab.current = null;
      resizing.current = null;
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [size]);

  const panelStyle: CSSProperties | undefined =
    offset || size
      ? {
          position: "fixed",
          left: offset?.x,
          top: offset?.y,
          width: size?.w,
          height: size?.h,
          right: "auto",
          bottom: "auto",
          margin: 0,
          zIndex: 60,
          maxHeight: "none",
        }
      : undefined;

  return {
    panelRef,
    panelStyle,
    onHandlePointerDown,
    onResizePointerDown,
    isFloating: offset !== null,
  };
}
