import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Link } from "react-router-dom";
import { fetchCardById } from "../lib/scryfallApi";
import type { DrawerCardView } from "../types/drawer";
import type { ScryfallCard } from "../types/scryfallCard";
import { getFaceImage, isMultiCard } from "../utils/scryfall";
import styles from "./DrawerCardTile.module.css";

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
  const faceRef = useRef<HTMLButtonElement | null>(null);
  const [hovered, setHovered] = useState(false);
  const [tilt, setTilt] = useState<{
    rx: number;
    ry: number;
    gx: number;
    gy: number;
  } | null>(null);
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

  const multi = scry ? isMultiCard(scry) : false;
  const front = scry ? getFaceImage(scry, 0) : card.image_url;
  const back = scry ? getFaceImage(scry, 1) : null;
  const shown = face === "back" && back ? back : front;

  const onMove = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    const el = faceRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width < 8 || rect.height < 8) return;
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    setTilt({
      rx: -((py * 2 - 1) * 12),
      ry: (px * 2 - 1) * 15,
      gx: px * 100,
      gy: py * 100,
    });
  }, []);

  const tiltStyle: CSSProperties | undefined = hovered
    ? tilt
      ? {
          transform: `perspective(900px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg) scale3d(1.04, 1.04, 1.04)`,
          ["--glare-x" as string]: `${tilt.gx}%`,
          ["--glare-y" as string]: `${tilt.gy}%`,
        }
      : {
          transform:
            "perspective(900px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)",
        }
    : undefined;

  return (
    <div
      className={`${styles.tile}${hovered ? ` ${styles.tileLive}` : ""}`}
      onPointerEnter={() => setHovered(true)}
      onPointerMove={onMove}
      onPointerLeave={() => {
        setHovered(false);
        setTilt(null);
      }}
    >
      <Link
        className={`${styles.slide} ${styles.nameSlide}`}
        to={card.scryfall_id ? `/card/${card.scryfall_id}` : "#"}
        onClick={(e) => {
          if (!card.scryfall_id) e.preventDefault();
        }}
      >
        {card.name}
      </Link>

      <div className={`${styles.slide} ${styles.tierSlide}`}>
        <span className={styles.railLabel}>Tier</span>
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
        <span className={styles.tierVal}>{card.tier ?? 1}</span>
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

      <button
        type="button"
        className={`${styles.slide} ${styles.removeSlide}`}
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
      >
        Remove
      </button>

      <button
        ref={faceRef}
        type="button"
        className={`${styles.artBtn}${hovered ? ` ${styles.artAwake}` : ""}`}
        style={tiltStyle}
        onClick={onOpen}
        aria-label={card.name}
      >
        {shown ? (
          <img src={shown} alt="" className={styles.art} />
        ) : (
          <span className={styles.fallback}>{card.name}</span>
        )}
        {hovered && <span className={styles.glare} aria-hidden />}
        {showTierMark && (
          <span className={styles.ear} aria-label={`Tier ${card.tier ?? 1}`}>
            {card.tier ?? 1}
          </span>
        )}
      </button>

      {hovered && multi && back && (
        <button
          type="button"
          className={styles.flipBtn}
          onClick={(e) => {
            e.stopPropagation();
            setFace((f) => (f === "front" ? "back" : "front"));
          }}
        >
          Flip
        </button>
      )}
    </div>
  );
}
