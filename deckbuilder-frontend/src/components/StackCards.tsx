import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
} from "react";
import styles from "../pages/DeckBuilderPage.module.css";

const StackHoverContext = createContext<number | null>(null);

/** Index of the card currently being revealed in this stack, or null. */
export function useStackHoverIndex() {
  return useContext(StackHoverContext);
}

type Props = {
  count: number;
  className?: string;
  children: ReactNode;
};

/**
 * Stack container: hover index from pointer Y on collapsed peek geometry
 * (transforms do not affect which card is considered under the cursor).
 */
export function StackCards({ count, className, children }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const updateHoverFromPointer = useCallback(
    (clientY: number) => {
      const el = ref.current;
      if (!el || count <= 0) {
        setHoverIdx(null);
        return;
      }
      const cs = getComputedStyle(el);
      const peek = parseFloat(cs.getPropertyValue("--stack-peek")) || 36;
      const rect = el.getBoundingClientRect();
      const y = clientY - rect.top;
      if (y < 0 || y > rect.height) {
        setHoverIdx(null);
        return;
      }
      let idx = Math.floor(y / peek);
      if (idx < 0) idx = 0;
      if (idx > count - 1) idx = count - 1;
      setHoverIdx(idx);
    },
    [count]
  );

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    // Don't fight active drags — pointer capture is on the draggable
    if (e.buttons === 1 && e.defaultPrevented) return;
    updateHoverFromPointer(e.clientY);
  }

  function onPointerLeave() {
    setHoverIdx(null);
  }

  return (
    <StackHoverContext.Provider value={hoverIdx}>
      <div
        ref={ref}
        className={`${styles.stackCards}${className ? ` ${className}` : ""}`}
        data-hover-idx={hoverIdx === null ? undefined : String(hoverIdx)}
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
      >
        {children}
      </div>
    </StackHoverContext.Provider>
  );
}
