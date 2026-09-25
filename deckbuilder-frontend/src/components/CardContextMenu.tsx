import { useEffect, useLayoutEffect, useRef, useState } from "react";
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
  | "mechanics"
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

type Flyout = "decks" | "share" | null;

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
  quantity?: number;
  tier?: number;
};

const MODAL_ITEMS: { id: ModalJump; label: string }[] = [
  { id: "info:details", label: "Info" },
  { id: "info:rulings", label: "Rulings" },
  { id: "deck", label: "Deck" },
  { id: "drawers", label: "Drawers" },
  { id: "mechanics", label: "Mechanics" },
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
  quantity,
  tier,
}: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [decks, setDecks] = useState<Deck[] | null>(null);
  const [fly, setFly] = useState<Flyout>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [pos, setPos] = useState({ left: x, top: y });
  const boxRef = useRef<HTMLDivElement | null>(null);

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
    if (!user || fly !== "decks" || decks) return;
    void listMyDecks(user.id).then(({ decks: list }) => setDecks(list ?? []));
  }, [user, fly, decks]);

  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const pad = 8;
    const r = el.getBoundingClientRect();
    let left = x;
    let top = y;
    if (left + r.width > window.innerWidth - pad) {
      left = window.innerWidth - r.width - pad;
    }
    if (top + r.height > window.innerHeight - pad) {
      top = window.innerHeight - r.height - pad;
    }
    left = Math.max(pad, left);
    top = Math.max(pad, top);
    setPos({ left, top });
  }, [x, y, fly, quantity, tier, status]);

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
  }

  async function copyUrl() {
    const url = `${window.location.origin}/card/${target.scryfallId}`;
    await navigator.clipboard.writeText(url);
    setStatus("URL copied");
  }

  async function fetchImageBlob(): Promise<Blob | null> {
    if (!target.imageUrl) return null;
    try {
      const res = await fetch(target.imageUrl);
      if (!res.ok) return null;
      return await res.blob();
    } catch {
      return null;
    }
  }

  async function copyImage() {
    const blob = await fetchImageBlob();
    if (!blob) {
      setStatus("Could not copy image");
      return;
    }
    try {
      await navigator.clipboard.write([
        new ClipboardItem({ [blob.type || "image/png"]: blob }),
      ]);
      setStatus("Image copied");
    } catch {
      setStatus("Clipboard blocked image copy");
    }
  }

  async function saveImage() {
    const blob = await fetchImageBlob();
    const name = `${target.name.replace(/[^\w-]+/g, "_")}.png`;
    if (blob) {
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = name;
      a.click();
      URL.revokeObjectURL(href);
      setStatus("Image saved");
      return;
    }
    if (target.imageUrl) window.open(target.imageUrl, "_blank", "noopener");
  }

  return createPortal(
    <div
      id="card-ctx-menu"
      ref={boxRef}
      className={styles.menu}
      style={{ left: pos.left, top: pos.top }}
      role="menu"
    >
      <div className={styles.pair}>
        <button
          type="button"
          onClick={() => {
            onEnhance();
            onClose();
          }}
        >
          Enhance
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
      </div>

      <div className={styles.fly}>
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
      </div>

      {onQty && (
        <div className={styles.stepper}>
          <span>Qty</span>
          <button type="button" onClick={() => onQty(-1)}>
            −
          </button>
          <strong>{quantity ?? "–"}</strong>
          <button type="button" onClick={() => onQty(1)}>
            +
          </button>
        </div>
      )}
      {onTier && (
        <div className={styles.stepper}>
          <span>Tier</span>
          <button type="button" onClick={() => onTier(-1)}>
            −
          </button>
          <strong>{tier ?? "–"}</strong>
          <button type="button" onClick={() => onTier(1)}>
            +
          </button>
        </div>
      )}

      {user && (
        <>
          <button
            type="button"
            className={fly === "decks" ? styles.active : undefined}
            onClick={() => setFly((v) => (v === "decks" ? null : "decks"))}
          >
            Add to deck ▸
          </button>
          {fly === "decks" && (
            <div className={styles.fly}>
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

      <button
        type="button"
        className={fly === "share" ? styles.active : undefined}
        onClick={() => setFly((v) => (v === "share" ? null : "share"))}
      >
        Share ▸
      </button>
      {fly === "share" && (
        <div className={styles.fly}>
          <button type="button" onClick={() => void copyImage()}>
            Copy image
          </button>
          <button type="button" onClick={() => void saveImage()}>
            Save image
          </button>
          <button type="button" onClick={() => void copyUrl()}>
            Copy card page URL
          </button>
        </div>
      )}

      {onRemove && (
        <button
          type="button"
          className={styles.danger}
          onClick={() => {
            onRemove();
            onClose();
          }}
        >
          Remove
        </button>
      )}
      {status && <p className={styles.hint}>{status}</p>}
    </div>,
    document.body
  );
}
