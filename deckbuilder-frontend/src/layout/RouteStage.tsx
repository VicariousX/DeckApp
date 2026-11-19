import { useRef, type ReactNode } from "react";
import { useLocation } from "react-router-dom";

/**
 * Remounts on pathname so each screen eases in.
 * Deeper paths arrive from the right; shorter paths return from the left.
 */
export function RouteStage({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const prev = useRef(pathname);
  const dir = useRef<"forward" | "back">("forward");
  if (pathname !== prev.current) {
    dir.current = pathname.length >= prev.current.length ? "forward" : "back";
    prev.current = pathname;
  }

  return (
    <div key={pathname} className={`route-stage route-stage-${dir.current}`}>
      {children}
    </div>
  );
}
