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
 * Drag a floating panel by a handle element.
 * Position is viewport-fixed when dragging has started; otherwise null (CSS-positioned).
 */
export function useDraggablePanel(open: boolean) {
  const [offset, setOffset] = useState<Pos | null>(null);
  const dragging = useRef(false);
  const start = useRef<{ mx: number; my: number; ox: number; oy: number } | null>(
    null
  );
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) setOffset(null);
  }, [open]);

  const onHandlePointerDown = useCallback(
    (e: ReactPointerEvent) => {
      if (e.button !== 0) return;
      const el = panelRef.current;
      if (!el) return;
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      const rect = el.getBoundingClientRect();
      // First drag: pin current screen position
      const ox = offset?.x ?? rect.left;
      const oy = offset?.y ?? rect.top;
      if (!offset) setOffset({ x: ox, y: oy });
      dragging.current = true;
      start.current = { mx: e.clientX, my: e.clientY, ox, oy };
    },
    [offset]
  );

  useEffect(() => {
    function onMove(e: PointerEvent) {
      if (!dragging.current || !start.current) return;
      const dx = e.clientX - start.current.mx;
      const dy = e.clientY - start.current.my;
      let x = start.current.ox + dx;
      let y = start.current.oy + dy;
      // Keep mostly on-screen
      const w = panelRef.current?.offsetWidth ?? 320;
      const h = panelRef.current?.offsetHeight ?? 200;
      x = Math.min(Math.max(8, x), window.innerWidth - Math.min(w, 120));
      y = Math.min(Math.max(8, y), window.innerHeight - 48);
      setOffset({ x, y });
    }
    function onUp() {
      dragging.current = false;
      start.current = null;
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
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

  return { panelRef, panelStyle, onHandlePointerDown, isFloating: offset !== null };
}
