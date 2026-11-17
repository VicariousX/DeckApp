import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CardEnlargeOverlay } from "./CardImage";
import { ManaCost } from "./ManaCost";
import { fetchCardById } from "../lib/scryfallApi";
import { getOracleText } from "../utils/scryfall";
import type { ScryfallCard } from "../types/scryfallCard";
import type { DeckBoard, DeckCard } from "../types/deck";
import styles from "./DeckScrollStage.module.css";

const BOARDS: { id: DeckBoard; label: string }[] = [
  { id: "commander", label: "Command" },
  { id: "main", label: "Main" },
  { id: "side", label: "Side" },
  { id: "maybe", label: "Maybe" },
];

type Props = {
  cards: DeckCard[];
  startId: string;
  textMode: boolean;
  isOwner: boolean;
  imageFor: (card: DeckCard) => string | undefined;
  onClose: () => void;
  onInspect: (card: DeckCard) => void;
  onQty: (card: DeckCard, delta: number) => void;
  onBoard: (card: DeckCard, board: DeckBoard) => void;
  onRemove: (card: DeckCard) => void;
};

function wrap(index: number, length: number) {
  if (length <= 0) return 0;
  return ((index % length) + length) % length;
}

export function DeckScrollStage({
  cards,
  startId,
  textMode,
  isOwner,
  imageFor,
  onClose,
  onInspect,
  onQty,
  onBoard,
  onRemove,
}: Props) {
  const [index, setIndex] = useState(() => {
    const found = cards.findIndex((c) => c.id === startId);
    return found >= 0 ? found : 0;
  });
  const [details, setDetails] = useState<Record<string, ScryfallCard | null>>({});

  const length = cards.length;
  const current = cards[wrap(index, length)];
  const prev = length > 1 ? cards[wrap(index - 1, length)] : undefined;
  const next = length > 1 ? cards[wrap(index + 1, length)] : undefined;

  useEffect(() => {
    const wanted = [current, prev, next].filter((c): c is DeckCard => Boolean(c));
    let cancel = false;
    for (const card of wanted) {
      const id = card.scryfall_id;
      if (!id || details[id] !== undefined) continue;
      void fetchCardById(id).then(({ card: sc }) => {
        if (cancel) return;
        setDetails((map) => (map[id] !== undefined ? map : { ...map, [id]: sc }));
      });
    }
    return () => {
      cancel = true;
    };
  }, [current, prev, next, details]);

  useEffect(() => {
    let lock = false;
    function go(delta: number) {
      if (lock || length < 2) return;
      lock = true;
      window.setTimeout(() => {
        lock = false;
      }, 180);
      setIndex((cur) => wrap(cur + delta, length));
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowDown") {
        e.preventDefault();
        go(1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        go(-1);
      }
    }
    function onWheel(e: WheelEvent) {
      if (Math.abs(e.deltaY) < 8) return;
      e.preventDefault();
      go(e.deltaY > 0 ? 1 : -1);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("wheel", onWheel);
    };
  }, [length, onClose]);

  if (!current) return null;

  const face = (card: DeckCard | undefined) => {
    if (!card) return undefined;
    if (!textMode) return undefined;
    return <TextFace card={card} scryfall={details[card.scryfall_id] ?? null} />;
  };

  const scry = details[current.scryfall_id] ?? null;
  const pt = statLine(scry);

  return createPortal(
    <div
      className={styles.stage}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <button type="button" className={styles.exit} onClick={onClose} aria-label="Close">
        ×
      </button>
      <aside className={styles.rail}>
        <p className={styles.place}>
          {wrap(index, length) + 1} / {length}
        </p>
        <h2 className={styles.name}>{current.name}</h2>
        <ManaCost cost={current.mana_cost} size={16} />
        <p className={styles.type}>{current.type_line}</p>
        <p className={styles.meta}>
          Mana value {current.cmc ?? "—"}
          {pt ? ` · ${pt}` : ""}
          {current.quantity > 1 ? ` · ×${current.quantity}` : ""}
        </p>
      </aside>
      <CardEnlargeOverlay
        embedded
        mode="swipe"
        frontSrc={imageFor(current) || ""}
        frontName={current.name}
        nextSrc={next ? imageFor(next) : undefined}
        prevSrc={prev ? imageFor(prev) : undefined}
        faces={
          textMode
            ? { current: face(current)!, prev: face(prev), next: face(next) }
            : undefined
        }
        onClose={onClose}
        onSwipeUp={() => setIndex((cur) => wrap(cur + 1, length))}
        onSwipeDown={() => setIndex((cur) => wrap(cur - 1, length))}
        onSwipeRight={() => onInspect(current)}
        onSwipeLeft={onClose}
        keepOpenOnRight
        rightLabel="Inspect"
        leftLabel="Close"
        hint="Scroll to move through the deck"
      />
      <aside className={`${styles.rail} ${styles.railRight}`}>
        <div className={styles.qty}>
          {isOwner ? (
            <button type="button" onClick={() => onQty(current, -1)} aria-label="Decrease quantity">
              −
            </button>
          ) : null}
          <span>×{current.quantity}</span>
          {isOwner ? (
            <button type="button" onClick={() => onQty(current, 1)} aria-label="Increase quantity">
              +
            </button>
          ) : null}
        </div>
        <div className={styles.actions}>
          <button type="button" onClick={() => onInspect(current)}>
            Inspector
          </button>
          {isOwner
            ? BOARDS.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => onBoard(current, b.id)}
                  aria-pressed={current.board === b.id}
                >
                  {b.label}
                </button>
              ))
            : null}
          {isOwner ? (
            <button type="button" className={styles.danger} onClick={() => onRemove(current)}>
              Remove
            </button>
          ) : null}
        </div>
      </aside>
      <div className={styles.mobileActions}>
        <button type="button" onClick={() => onInspect(current)}>
          Inspector
        </button>
        {isOwner ? (
          <>
            <button type="button" onClick={() => onQty(current, -1)}>
              −
            </button>
            <button type="button" onClick={() => onQty(current, 1)}>
              +
            </button>
          </>
        ) : null}
      </div>
    </div>,
    document.body
  );
}

function statLine(card: ScryfallCard | null): string {
  if (!card) return "";
  if (card.power || card.toughness) return `${card.power ?? "—"}/${card.toughness ?? "—"}`;
  if (card.loyalty) return `Loyalty ${card.loyalty}`;
  if (card.defense) return `Defense ${card.defense}`;
  return "";
}

function TextFace({ card, scryfall }: { card: DeckCard; scryfall: ScryfallCard | null }) {
  const pt = statLine(scryfall);
  return (
    <article className={styles.textFace}>
      <h3 className={styles.textName}>{card.name}</h3>
      <ManaCost cost={card.mana_cost} size={15} />
      <p className={styles.textType}>{card.type_line}</p>
      <p className={styles.textStats}>
        Mana value {card.cmc ?? "—"}
        {pt ? ` · ${pt}` : ""}
        {scryfall == null ? " · Loading text…" : ""}
      </p>
      <p className={styles.oracle}>{scryfall ? getOracleText(scryfall).trim() || "No oracle text." : ""}</p>
    </article>
  );
}
