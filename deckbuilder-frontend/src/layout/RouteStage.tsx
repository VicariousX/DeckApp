import { useRef, type ReactNode } from "react";
import { useLocation } from "react-router-dom";

/**
 * Remounts on pathname. Forward travel comes in from the right.
 * Returning to a page already in the stack comes in from the left.
 */
export function RouteStage({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const stack = useRef<string[]>([pathname]);
  const dir = useRef<"forward" | "back">("forward");
  const top = stack.current[stack.current.length - 1];
  if (pathname !== top) {
    const prior = stack.current[stack.current.length - 2];
    if (prior === pathname) {
      dir.current = "back";
      stack.current.pop();
    } else {
      dir.current = "forward";
      stack.current.push(pathname);
    }
  }

  return (
    <div key={pathname} className={`route-stage route-stage-${dir.current}`}>
      {children}
    </div>
  );
}
