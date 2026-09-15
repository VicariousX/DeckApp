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

type CardRect = {
  idx: number;
  top: number;
  bottom: number;
  left: number;
  right: number;
  midY: number;
};

function readCardRects(container: HTMLElement): CardRect[] {
  const nodes = container.querySelectorAll<HTMLElement>("[data-stack-idx]");
  const out: CardRect[] = [];
  nodes.forEach((node) => {
    const raw = node.getAttribute("data-stack-idx");
    if (raw == null) return;
    const idx = Number(raw);
    if (!Number.isFinite(idx)) return;
    const r = node.getBoundingClientRect();
    out.push({
      idx,
      top: r.top,
      bottom: r.bottom,
      left: r.left,
      right: r.right,
      midY: (r.top + r.bottom) / 2,
    });
  });
  out.sort((a, b) => a.idx - b.idx);
  return out;
}

/**
 * Stack container: reveal is driven by which card the pointer is over using
 * live visual bounding boxes (so shifted "front" cards remain reachable).
 * Gaps between cards never clear the reveal — they hand off to the nearest card.
 */
export function StackCards({ count, className, children }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const hoverIdxRef = useRef<number | null>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const setHover = useCallback((idx: number | null) => {
    if (hoverIdxRef.current === idx) return;
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

      const cards = readCardRects(el);
      if (cards.length === 0) {
        setHover(null);
        return;
      }

      // 1) Direct hit on a card's current visual box (includes translateY)
      const hits = cards.filter(
        (c) =>
          clientY >= c.top &&
          clientY <= c.bottom &&
          clientX >= c.left &&
          clientX <= c.right
      );
      if (hits.length > 0) {
        // Prefer the topmost painted card (highest index) when boxes overlap
        hits.sort((a, b) => b.idx - a.idx);
        setHover(hits[0].idx);
        return;
      }

      // 2) In a gap inside the stack — hand off to nearest card by Y, never collapse
      let best = cards[0];
      let bestDist = Math.abs(clientY - best.midY);
      for (let i = 1; i < cards.length; i++) {
        const d = Math.abs(clientY - cards[i].midY);
        if (d < bestDist) {
          best = cards[i];
          bestDist = d;
        }
      }
      setHover(best.idx);
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
