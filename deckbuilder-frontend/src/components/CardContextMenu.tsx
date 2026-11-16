import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { addCardToDeck, listMyDecks } from "../services/deckService";
import { listDrawers } from "../services/drawerService";
import { listMyCollections } from "../services/collectionService";
import { addToGroup } from "../services/membershipService";
import type { Deck } from "../types/deck";
import type { Drawer } from "../types/drawer";
import type { Collection } from "../types/collection";
import styles from "./CardContextMenu.module.css";

export type ModalJump =
  | "info"
  | "info:details"
  | "info:rulings"
  | "deck"
  | "drawers"
  | "collections"
  | "mechanics"
  | "artwork"
  | "artwork:prints"
  | "artwork:proxy"
  | "artwork:upload";

export type InspectorTabName =
  | "info"
  | "deck"
  | "drawer"
  | "drawers"
  | "collections"
  | "mechanics"
  | "artwork";

export function modalJumpFromState(
  tab: InspectorTabName,
  infoSub: "details" | "rulings" = "details",
  artSub: "upload" | "prints" | "proxy" = "prints"
): ModalJump {
  if (tab === "info") return infoSub === "rulings" ? "info:rulings" : "info";
  if (tab === "artwork") {
    if (artSub === "upload") return "artwork:upload";
    if (artSub === "proxy") return "artwork:proxy";
    return "artwork";
  }
  if (tab === "drawer") return "drawers";
  return tab;
}

/** Map a context-menu jump onto a main tab id. */
export function initialTabFromJump(jump: ModalJump): InspectorTabName {
  if (jump.startsWith("artwork")) return "artwork";
  if (jump.startsWith("info")) return "info";
  if (
    jump === "deck" ||
    jump === "drawers" ||
    jump === "collections" ||
    jump === "mechanics"
  ) {
    return jump;
  }
  return "info";
}

export type CardContextTarget = {
  scryfallId: string;
  oracleId?: string;
  name: string;
  typeLine?: string;
  imageUrl?: string;
  imageUrlBack?: string;
};

type Flyout = "decks" | "drawers" | "collections" | "share" | "move" | "links" | "tabs" | null;

type MenuSection = {
  id: Exclude<Flyout, null>;
  label: string;
  hint: string;
  content: ReactNode;
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
  quantity?: number;
  tier?: number;
  tabs?: ModalJump[];
  hideAddToDeck?: boolean;
  linkChoices?: { id: string; name: string; on: boolean; onToggle: () => void }[];
  moveTargets?: { label: string; onSelect: () => void }[];
  onStartScroll?: () => void;
};

const MODAL_ITEMS: { id: ModalJump; label: string }[] = [
  { id: "info:details", label: "Info" },
  { id: "info:rulings", label: "Rulings" },
  { id: "deck", label: "Deck" },
  { id: "drawers", label: "Drawers" },
  { id: "collections", label: "Collections" },
  { id: "mechanics", label: "Mechanics" },
  { id: "artwork:prints", label: "Printings" },
  { id: "artwork:proxy", label: "Proxy" },
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
  tabs,
  hideAddToDeck,
  linkChoices,
  moveTargets,
  onStartScroll,
}: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [decks, setDecks] = useState<Deck[] | null>(null);
  const [drawers, setDrawers] = useState<Drawer[] | null>(null);
  const [collections, setCollections] = useState<Collection[] | null>(null);
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

  useEffect(() => {
    if (!user || fly !== "drawers" || drawers) return;
    void listDrawers(user.id).then(({ drawers: list }) => setDrawers(list ?? []));
  }, [user, fly, drawers]);

  useEffect(() => {
    if (!user || fly !== "collections" || collections) return;
    void listMyCollections(user.id).then(({ collections: list }) => setCollections(list ?? []));
  }, [user, fly, collections]);

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
  }, [x, y, fly, quantity, tier, status, linkChoices]);

  async function addToDeck(deckId: string) {
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

  async function addToDrawer(drawerId: string) {
    const { error } = await addToGroup("drawer", drawerId, {
      oracleId: target.oracleId || target.scryfallId,
      scryfallId: target.scryfallId,
      name: target.name,
    });
    setStatus(error ?? "Added to drawer");
  }

  async function addToCollection(collection: Collection) {
    const { error } = await addToGroup("collection", collection.id, {
      oracleId: target.oracleId || target.scryfallId,
      scryfallId: target.scryfallId,
      name: target.name,
    }, { collection });
    setStatus(error ?? `Added to ${collection.name}`);
  }

  async function copyUrl() {
    const url = `${window.location.origin}/card/${target.scryfallId}`;
    await navigator.clipboard.writeText(url);
    setStatus("URL copied");
  }

  async function fetchImagePng(): Promise<Blob | null> {
    if (!target.imageUrl) return null;
    try {
      const res = await fetch(target.imageUrl, { mode: "cors" });
      if (res.ok) {
        const raw = await res.blob();
        if (raw.type === "image/png") return raw;
        const bmp = await createImageBitmap(raw);
        const canvas = document.createElement("canvas");
        canvas.width = bmp.width;
        canvas.height = bmp.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return raw;
        ctx.drawImage(bmp, 0, 0);
        bmp.close();
        const png = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob((b) => resolve(b), "image/png")
        );
        return png ?? raw;
      }
    } catch {
      /* try element decode */
    }
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.crossOrigin = "anonymous";
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error("img"));
        el.src = target.imageUrl!;
      });
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.drawImage(img, 0, 0);
      return await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), "image/png")
      );
    } catch {
      return null;
    }
  }

  async function copyImage() {
    const blob = await fetchImagePng();
    if (blob && navigator.clipboard?.write) {
      try {
        await navigator.clipboard.write([
          new ClipboardItem({
            "image/png": Promise.resolve(blob),
          }),
        ]);
        setStatus("Image copied");
        return;
      } catch {
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ "image/png": blob }),
          ]);
          setStatus("Image copied");
          return;
        } catch {
          /* fall through */
        }
      }
    }
    if (target.imageUrl && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(target.imageUrl);
        setStatus("Image URL copied");
        return;
      } catch {
        /* fall through */
      }
    }
    setStatus("Could not copy image");
  }

  async function saveImage() {
    const blob = await fetchImagePng();
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

  const sections: MenuSection[] = [];
  if (linkChoices && linkChoices.length > 0) {
    sections.push({
      id: "links",
      label: "Works with",
      hint: "Link this card to others in the combo.",
      content: linkChoices.map((c) => (
        <button
          key={c.id}
          type="button"
          className={c.on ? styles.active : undefined}
          onClick={c.onToggle}
        >
          {c.on ? "● " : "○ "}
          {c.name}
        </button>
      )),
    });
  }
  if (moveTargets && moveTargets.length > 0) {
    sections.push({
      id: "move",
      label: "Move to",
      hint: "Moves this copy onto another board.",
      content: moveTargets.map((t) => (
        <button
          key={t.label}
          type="button"
          onClick={() => {
            t.onSelect();
            onClose();
          }}
        >
          {t.label}
        </button>
      )),
    });
  }
  sections.push({
    id: "tabs",
    label: "Card inspector",
    hint: "Opens the inspector on this part of the card.",
    content: (tabs ? MODAL_ITEMS.filter((item) => tabs.includes(item.id)) : MODAL_ITEMS).map((item) => (
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
    )),
  });
  if (user && !hideAddToDeck) {
    sections.push({
      id: "decks",
      label: "Add to deck",
      hint: "Adds one copy to that deck’s maybeboard.",
      content: (
        <>
          {!decks && <p className={styles.hint}>Loading…</p>}
          {decks?.length === 0 && <p className={styles.hint}>No decks</p>}
          {decks?.map((d) => (
            <button key={d.id} type="button" onClick={() => void addToDeck(d.id)}>
              {d.name}
            </button>
          ))}
        </>
      ),
    });
    sections.push({
      id: "drawers",
      label: "Add to drawer",
      hint: "Saves this card into a drawer.",
      content: (
        <>
          {!drawers && <p className={styles.hint}>Loading…</p>}
          {drawers?.length === 0 && <p className={styles.hint}>No drawers</p>}
          {drawers?.map((d) => (
            <button key={d.id} type="button" onClick={() => void addToDrawer(d.id)}>
              {d.name}
            </button>
          ))}
        </>
      ),
    });
    sections.push({
      id: "collections",
      label: "Add to collection",
      hint: "Marks this card in a collection.",
      content: (
        <>
          {!collections && <p className={styles.hint}>Loading…</p>}
          {collections?.length === 0 && <p className={styles.hint}>No collections</p>}
          {collections?.map((c) => (
            <button key={c.id} type="button" onClick={() => void addToCollection(c)}>
              {c.name}
            </button>
          ))}
        </>
      ),
    });
  }
  sections.push({
    id: "share",
    label: "Share",
    hint: "Copy or save this printing.",
    content: (
      <>
        <button type="button" onClick={() => void copyImage()}>
          Copy image
        </button>
        <button type="button" onClick={() => void saveImage()}>
          Save image
        </button>
        <button type="button" onClick={() => void copyUrl()}>
          Copy card page URL
        </button>
      </>
    ),
  });

  const activeIndex = sections.findIndex((s) => s.id === fly);
  const active = activeIndex >= 0 ? sections[activeIndex] : null;
  const prevSection = activeIndex > 0 ? sections[activeIndex - 1] : null;
  const nextSection = activeIndex >= 0 && activeIndex < sections.length - 1 ? sections[activeIndex + 1] : null;

  return createPortal(
    <div
      id="card-ctx-menu"
      ref={boxRef}
      className={styles.menu}
      style={{ left: pos.left, top: pos.top }}
      role="menu"
    >
      {active ? (
        <>
          <div className={styles.queue}>
            {prevSection ? (
              <button
                type="button"
                className={styles.queuePrev}
                onClick={() => setFly(prevSection.id)}
              >
                {prevSection.label}
              </button>
            ) : (
              <span />
            )}
            <button
              type="button"
              className={styles.queueActive}
              aria-current="page"
              onClick={() => setFly(null)}
            >
              {active.label}
            </button>
            {nextSection ? (
              <button
                type="button"
                className={styles.queueNext}
                onClick={() => setFly(nextSection.id)}
              >
                {nextSection.label}
              </button>
            ) : (
              <span />
            )}
          </div>
          <div className={styles.fly}>
            <p className={styles.sectionHint}>{active.hint}</p>
            {active.content}
          </div>
          {status && <p className={styles.hint}>{status}</p>}
        </>
      ) : (
        <>
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

      {onQty && (
        <div className={styles.stepper}>
          <span>Quantity</span>
          <button type="button" onClick={() => onQty(-1)} aria-label="Decrease quantity">
            −
          </button>
          <strong>{quantity ?? "–"}</strong>
          <button type="button" onClick={() => onQty(1)} aria-label="Increase quantity">
            +
          </button>
        </div>
      )}
      {onTier && (
        <div className={styles.stepper}>
          <span>Tier</span>
          <button type="button" onClick={() => onTier(-1)} aria-label="Decrease tier">
            −
          </button>
          <strong>{tier ?? "–"}</strong>
          <button type="button" onClick={() => onTier(1)} aria-label="Increase tier">
            +
          </button>
        </div>
      )}

      {onStartScroll && (
        <button
          type="button"
          onClick={() => {
            onStartScroll();
            onClose();
          }}
        >
          Start scroll from this card
        </button>
      )}

      {sections.map((section) => (
        <button
          key={section.id}
          type="button"
          className={styles.sectionBtn}
          onClick={() => setFly(section.id)}
        >
          <span>{section.label}</span>
          <span className={styles.chev} aria-hidden>▸</span>
        </button>
      ))}

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
        </>
      )}
    </div>,
    document.body
  );
}
