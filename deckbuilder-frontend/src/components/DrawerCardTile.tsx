import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import { fetchCardById } from "../lib/scryfallApi";
import type { DrawerCardView } from "../types/drawer";
import type { ScryfallCard } from "../types/scryfallCard";
import { getFaceImage, isMultiCard } from "../utils/scryfall";
import { CardImage } from "./CardImage";
import styles from "./DrawerCardTile.module.css";

const DWELL_MS = 820;
const MOVE_PX = 5;

type Props = {
  card: DrawerCardView;
  showTierMark: boolean;
  onOpen: () => void;
  onRemove: () => void;
  onTier: (next: number) => void;
};

export function DrawerCardTile({
  card,
  showTierMark,
  onOpen,
  onRemove,
  onTier,
}: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const dwellRef = useRef<number | null>(null);
  const lastPt = useRef<{ x: number; y: number } | null>(null);
  const [hovered, setHovered] = useState(false);
  const [ring, setRing] = useState(false);
  const [popped, setPopped] = useState(false);
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const [scry, setScry] = useState<ScryfallCard | null>(null);
  const [face, setFace] = useState<"front" | "back">("front");

  useEffect(() => {
    if (!card.scryfall_id) return;
    let cancel = false;
    void fetchCardById(card.scryfall_id).then(({ card: c }) => {
      if (!cancel && c) setScry(c);
    });
    return () => {
      cancel = true;
    };
  }, [card.scryfall_id]);

  useEffect(() => {
    return () => {
      if (dwellRef.current) window.clearTimeout(dwellRef.current);
    };
  }, []);

  const multi = scry ? isMultiCard(scry) : false;
  const front = scry ? getFaceImage(scry, 0) : card.image_url;
  const back = scry ? getFaceImage(scry, 1) : null;
  const shown = face === "back" && back ? back : front;

  function clearDwell() {
    if (dwellRef.current) {
      window.clearTimeout(dwellRef.current);
      dwellRef.current = null;
    }
    setRing(false);
  }

  function startDwell() {
    clearDwell();
    setRing(true);
    dwellRef.current = window.setTimeout(() => {
      const r = rootRef.current?.getBoundingClientRect();
      if (r) setAnchor(r);
      setPopped(true);
    }, DWELL_MS);
  }

  function onEnter(e: ReactPointerEvent) {
    setHovered(true);
    lastPt.current = { x: e.clientX, y: e.clientY };
    startDwell();
  }

  function onMove(e: ReactPointerEvent) {
    if (popped) return;
    const last = lastPt.current;
    lastPt.current = { x: e.clientX, y: e.clientY };
    if (!last) return;
    const dx = e.clientX - last.x;
    const dy = e.clientY - last.y;
    if (Math.hypot(dx, dy) > MOVE_PX) startDwell();
  }

  function onLeave() {
    if (popped) return;
    setHovered(false);
    clearDwell();
  }

  function closePop() {
    setPopped(false);
    setHovered(false);
    setAnchor(null);
    clearDwell();
  }

  const tools = (
    <>
      <div className={`${styles.rail} ${styles.railTop}`}>{card.name}</div>
      <div className={`${styles.rail} ${styles.railBottom}`}>
        {card.type_line || "—"}
      </div>
      <div className={`${styles.rail} ${styles.railLeft}`}>
        <span className={styles.railLabel}>Tier</span>
        <div className={styles.tierRow}>
          <button
            type="button"
            className={styles.tinyBtn}
            disabled={(card.tier ?? 1) <= 1}
            onClick={(e) => {
              e.stopPropagation();
              onTier((card.tier ?? 1) - 1);
            }}
          >
            −
          </button>
          <span>{card.tier ?? 1}</span>
          <button
            type="button"
            className={styles.tinyBtn}
            onClick={(e) => {
              e.stopPropagation();
              onTier((card.tier ?? 1) + 1);
            }}
          >
            +
          </button>
        </div>
      </div>
      <div className={`${styles.rail} ${styles.railRight}`}>
        <button
          type="button"
          className={styles.remove}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        >
          Remove
        </button>
      </div>
    </>
  );

  return (
    <div
      ref={rootRef}
      className={`${styles.tile}${hovered || popped ? ` ${styles.tileLive}` : ""}`}
      onPointerEnter={onEnter}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
    >
      <button
        type="button"
        className={styles.artBtn}
        onClick={onOpen}
        aria-label={card.name}
      >
        {shown ? (
          <img src={shown} alt="" className={styles.art} />
        ) : (
          <span className={styles.fallback}>{card.name}</span>
        )}
        {showTierMark && (
          <span className={styles.ear} aria-label={`Tier ${card.tier ?? 1}`}>
            {card.tier ?? 1}
          </span>
        )}
        {hovered && !popped && (
          <span className={`${styles.ring} ${ring ? styles.ringRun : ""}`} />
        )}
      </button>

      {hovered && !popped && multi && (
        <div className={styles.flipBar}>
          <button
            type="button"
            className={`${styles.flipBtn}${face === "front" ? ` ${styles.flipOn}` : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              setFace("front");
            }}
          >
            Front
          </button>
          {back && (
            <button
              type="button"
              className={`${styles.flipBtn}${face === "back" ? ` ${styles.flipOn}` : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                setFace("back");
              }}
            >
              Back
            </button>
          )}
        </div>
      )}

      {hovered && !popped && <div className={styles.tools}>{tools}</div>}

      {popped &&
        anchor &&
        createPortal(
          <div
            className={styles.popLayer}
            onPointerLeave={closePop}
          >
            <div
              className={styles.popWrap}
              style={{
                left: anchor.left + anchor.width / 2,
                top: anchor.top + anchor.height / 2,
              }}
            >
              <div className={styles.popCard} onClick={onOpen}>
                {scry ? (
                  <CardImage
                    card={scry}
                    tilt
                    hideFaceBadge
                    bothLayout="stack"
                    overrideFrontSrc={front ?? undefined}
                    overrideBackSrc={back ?? undefined}
                  />
                ) : shown ? (
                  <img src={shown} alt={card.name} />
                ) : null}
              </div>
              <div className={`${styles.tools} ${styles.toolsPop}`}>{tools}</div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
