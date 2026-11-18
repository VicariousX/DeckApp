import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CardEnlargeOverlay } from "./CardImage";
import { ManaCost } from "./ManaCost";
import { fetchCardById } from "../lib/scryfallApi";
import { getOracleText } from "../utils/scryfall";
import type { ScryfallCard } from "../types/scryfallCard";
import type { DeckBoard, DeckCard } from "../types/deck";
import type { ModalJump } from "./CardContextMenu";
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
  onInspect: (card: DeckCard, jump?: ModalJump) => void;
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
    function blocked() {
      return document.querySelector("[data-modal-root]") != null;
    }
    function onKey(e: KeyboardEvent) {
      if (blocked()) return;
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
      if (blocked()) return;
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
  const oracle = scry ? getOracleText(scry).trim() : "";
  const open = (jump?: ModalJump) => onInspect(current, jump);

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
          {wrap(index, length) + 1} of {length}
          <span>{boardLabel(current.board)}</span>
        </p>
        <h2 className={styles.name}>{current.name}</h2>
        <ManaCost cost={current.mana_cost} size={16} />
        <p className={styles.type}>{current.type_line}</p>
        <dl className={styles.facts}>
          <div>
            <dt>Mana value</dt>
            <dd>{current.cmc ?? "—"}</dd>
          </div>
          {pt ? (
            <div>
              <dt>{pt.label}</dt>
              <dd>{pt.value}</dd>
            </div>
          ) : null}
          {scry?.rarity ? (
            <div>
              <dt>Rarity</dt>
              <dd>{scry.rarity}</dd>
            </div>
          ) : null}
          {scry?.set_name ? (
            <div>
              <dt>Set</dt>
              <dd>{scry.set_name}</dd>
            </div>
          ) : null}
          <div>
            <dt>Copies</dt>
            <dd>{current.quantity}</dd>
          </div>
        </dl>
        <p className={styles.oracleSide}>{oracle || (scry ? "No oracle text." : "Loading text…")}</p>
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
        onActivate={() => open()}
        onSwipeUp={() => setIndex((cur) => wrap(cur + 1, length))}
        onSwipeDown={() => setIndex((cur) => wrap(cur - 1, length))}
        onSwipeRight={() => open()}
        onSwipeLeft={onClose}
        keepOpenOnRight
        rightLabel="Inspect"
        leftLabel="Close"
        hint="Scroll to move · click the card to inspect"
      />
      <aside className={`${styles.rail} ${styles.railRight}`}>
        {isOwner ? (
          <section>
            <p className={styles.groupLabel}>Quantity</p>
            <div className={styles.qty}>
              <button type="button" onClick={() => onQty(current, -1)} aria-label="Decrease quantity">
                −
              </button>
              <span>×{current.quantity}</span>
              <button type="button" onClick={() => onQty(current, 1)} aria-label="Increase quantity">
                +
              </button>
            </div>
          </section>
        ) : null}
        {isOwner ? (
          <section>
            <p className={styles.groupLabel}>Board</p>
            <div className={styles.boardGrid}>
              {BOARDS.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  className={current.board === b.id ? styles.pressed : undefined}
                  onClick={() => onBoard(current, b.id)}
                  aria-pressed={current.board === b.id}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </section>
        ) : null}
        <section>
          <p className={styles.groupLabel}>Open</p>
          <div className={styles.actions}>
            {(
              [
                ["info", "Inspector"],
                ["info:rulings", "Rulings"],
                ["deck", "Deck"],
                ["drawers", "Drawers"],
                ["collections", "Collections"],
                ["mechanics", "Mechanics"],
                ["artwork:prints", "Printings"],
                ["artwork:proxy", "Proxy"],
              ] as [ModalJump, string][]
            ).map(([jump, label]) => (
              <button key={jump} type="button" onClick={() => open(jump)}>
                {label}
              </button>
            ))}
          </div>
        </section>
        {isOwner ? (
          <button type="button" className={styles.danger} onClick={() => onRemove(current)}>
            Remove from deck
          </button>
        ) : null}
      </aside>
    </div>,
    document.body
  );
}

function boardLabel(board: DeckBoard): string {
  return BOARDS.find((b) => b.id === board)?.label ?? board;
}

function statLine(card: ScryfallCard | null): { label: string; value: string } | null {
  if (!card) return null;
  if (card.power || card.toughness) {
    return { label: "Power / toughness", value: `${card.power ?? "—"}/${card.toughness ?? "—"}` };
  }
  if (card.loyalty) return { label: "Loyalty", value: card.loyalty };
  if (card.defense) return { label: "Defense", value: card.defense };
  return null;
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
        {pt ? ` · ${pt.value}` : ""}
        {scryfall == null ? " · Loading text…" : ""}
      </p>
      <p className={styles.oracle}>{scryfall ? getOracleText(scryfall).trim() || "No oracle text." : ""}</p>
    </article>
  );
}
