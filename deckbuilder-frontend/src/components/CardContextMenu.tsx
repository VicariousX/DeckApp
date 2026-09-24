import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { addCardToDeck, listMyDecks } from "../services/deckService";
import type { Deck } from "../types/deck";
import styles from "./CardContextMenu.module.css";

export type ModalJump =
  | "info"
  | "info:details"
  | "info:rulings"
  | "deck"
  | "drawers"
  | "artwork"
  | "artwork:prints"
  | "artwork:upload";

export type CardContextTarget = {
  scryfallId: string;
  oracleId?: string;
  name: string;
  typeLine?: string;
  imageUrl?: string;
  imageUrlBack?: string;
};

type Props = {
  x: number;
  y: number;
  target: CardContextTarget;
  onClose: () => void;
  onEnhance: () => void;
  onOpenModal: (jump: ModalJump) => void;
  onQty?: (delta: number) => void;
  onTier?: (delta: number) => void;
  onRemove?: () => void;
  qtyLabel?: string;
};

const MODAL_ITEMS: { id: ModalJump; label: string }[] = [
  { id: "info:details", label: "Info" },
  { id: "info:rulings", label: "Rulings" },
  { id: "deck", label: "Deck" },
  { id: "drawers", label: "Drawers" },
  { id: "artwork:prints", label: "Printings" },
  { id: "artwork:upload", label: "Upload art" },
];

export function CardContextMenu({
  x,
  y,
  target,
  onClose,
  onEnhance,
  onOpenModal,
  onQty,
  onTier,
  onRemove,
  qtyLabel = "Quantity",
}: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [decks, setDecks] = useState<Deck[] | null>(null);
  const [deckOpen, setDeckOpen] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      const el = document.getElementById("card-ctx-menu");
      if (el && !el.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  useEffect(() => {
    if (!user || !deckOpen || decks) return;
    void listMyDecks(user.id).then(({ decks: list }) => setDecks(list ?? []));
  }, [user, deckOpen, decks]);

  const left = Math.min(x, window.innerWidth - 220);
  const top = Math.min(y, window.innerHeight - 320);

  async function share() {
    const url = `${window.location.origin}/card/${target.scryfallId}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: target.name, url });
      } else {
        await navigator.clipboard.writeText(url);
        setStatus("Link copied");
        setTimeout(() => setStatus(null), 1500);
      }
    } catch {
      await navigator.clipboard.writeText(url);
      setStatus("Link copied");
    }
  }

  async function addTo(deckId: string) {
    const { error } = await addCardToDeck(deckId, {
      oracle_id: target.oracleId || target.scryfallId,
      scryfall_id: target.scryfallId,
      name: target.name,
      type_line: target.typeLine || "",
      quantity: 1,
      board: "maybe",
    });
    setStatus(error ?? "Added to maybeboard");
    if (!error) setTimeout(onClose, 700);
  }

  return createPortal(
    <div
      id="card-ctx-menu"
      className={styles.menu}
      style={{ left, top }}
      role="menu"
    >
      <button type="button" onClick={() => { onEnhance(); onClose(); }}>
        Enhance
      </button>
      <div className={styles.sep} />
      <p className={styles.group}>Open modal</p>
      {MODAL_ITEMS.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => {
            onOpenModal(item.id);
            onClose();
          }}
        >
          {item.label}
        </button>
      ))}
      {(onQty || onTier) && <div className={styles.sep} />}
      {onQty && (
        <div className={styles.row}>
          <span>{qtyLabel}</span>
          <button type="button" onClick={() => onQty(-1)}>−</button>
          <button type="button" onClick={() => onQty(1)}>+</button>
        </div>
      )}
      {onTier && (
        <div className={styles.row}>
          <span>Tier</span>
          <button type="button" onClick={() => onTier(-1)}>−</button>
          <button type="button" onClick={() => onTier(1)}>+</button>
        </div>
      )}
      {onRemove && (
        <button type="button" className={styles.danger} onClick={() => { onRemove(); onClose(); }}>
          Remove
        </button>
      )}
      {user && (
        <>
          <div className={styles.sep} />
          <button type="button" onClick={() => setDeckOpen((v) => !v)}>
            Add to deck…
          </button>
          {deckOpen && (
            <div className={styles.sub}>
              {!decks && <p className={styles.hint}>Loading…</p>}
              {decks?.length === 0 && <p className={styles.hint}>No decks</p>}
              {decks?.map((d) => (
                <button key={d.id} type="button" onClick={() => void addTo(d.id)}>
                  {d.name}
                </button>
              ))}
            </div>
          )}
        </>
      )}
      <div className={styles.sep} />
      <button type="button" onClick={() => void share()}>
        Share
      </button>
      <button
        type="button"
        onClick={() => {
          navigate(`/card/${target.scryfallId}`);
          onClose();
        }}
      >
        Card page
      </button>
      {status && <p className={styles.hint}>{status}</p>}
    </div>,
    document.body
  );
}
