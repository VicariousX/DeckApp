import { createPortal } from "react-dom";
import type { DeckCard } from "../types/deck";

type Props = {
  card: DeckCard | null;
  src: string | null;
  x: number;
  y: number;
};

/**
 * Renders above the cursor, portaled to document.body.
 * All positioning is inline so CSS-module / ancestor transform issues cannot shift it.
 */
export function CardHoverPreview({ card, src, x, y }: Props) {
  if (!card) return null;
  return createPortal(
    <div
      style={{
        position: "fixed",
        left: x,
        top: y,
        transform: "translate(-50%, calc(-100% - 14px))",
        zIndex: 100000,
        pointerEvents: "none",
        width: 168,
        margin: 0,
        borderRadius: 8,
        overflow: "hidden",
        border: "1px solid var(--color-border, #444)",
        boxShadow: "0 12px 40px rgba(0,0,0,0.45)",
        background: "var(--color-surface, #1a1a1a)",
        opacity: src ? 1 : 0.85,
        transition: "opacity 0.08s ease",
      }}
    >
      {src ? (
        <img
          src={src}
          alt={card.name}
          style={{ display: "block", width: "100%", height: "auto" }}
        />
      ) : (
        <div
          style={{
            width: 168,
            height: 234,
            display: "grid",
            placeItems: "center",
            color: "var(--color-text-muted, #888)",
            fontSize: "1.25rem",
          }}
        >
          …
        </div>
      )}
    </div>,
    document.body
  );
}
