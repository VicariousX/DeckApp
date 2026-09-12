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
 * Stack container: hover index from pointer position.
 * Once a card is revealed, its full bounding box keeps focus so the pointer
 * can move over the entire exposed card without the reveal collapsing.
 */
export function StackCards({ count, className, children }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const hoverIdxRef = useRef<number | null>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const setHover = useCallback((idx: number | null) => {
    hoverIdxRef.current = idx;
    setHoverIdx(idx);
  }, []);

  const updateHoverFromPointer = useCallback(
    (clientX: number, clientY: number) => {
      const el = ref.current;
      if (!el || count <= 0) {
        setHover(null);
        return;
      }

      const rect = el.getBoundingClientRect();
      if (
        clientY < rect.top ||
        clientY > rect.bottom ||
        clientX < rect.left ||
        clientX > rect.right
      ) {
        setHover(null);
        return;
      }

      const current = hoverIdxRef.current;

      // While a card is revealed it is not translated — its full box stays put.
      // Keep focus as long as the pointer remains over that card.
      if (current != null) {
        const cardEl = el.querySelector(
          `[data-stack-idx="${current}"]`
        ) as HTMLElement | null;
        if (cardEl) {
          const cr = cardEl.getBoundingClientRect();
          if (
            clientY >= cr.top &&
            clientY <= cr.bottom &&
            clientX >= cr.left &&
            clientX <= cr.right
          ) {
            return; // still over the full revealed card
          }
        }
      }

      // Collapsed geometry: each card owns a peek-tall strip from the top.
      const cs = getComputedStyle(el);
      const peek = parseFloat(cs.getPropertyValue("--stack-peek")) || 36;
      const y = clientY - rect.top;
      let idx = Math.floor(y / peek);
      if (idx < 0) idx = 0;
      if (idx > count - 1) idx = count - 1;
      setHover(idx);
    },
    [count, setHover]
  );

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    updateHoverFromPointer(e.clientX, e.clientY);
  }

  function onPointerLeave() {
    setHover(null);
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
