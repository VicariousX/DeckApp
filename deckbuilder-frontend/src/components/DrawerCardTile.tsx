import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { Link } from "react-router-dom";
import { useArtPreferences } from "../auth/ArtPreferencesProvider";
import { fetchCardById } from "../lib/scryfallApi";
import type { DrawerCardView } from "../types/drawer";
import type { ScryfallCard } from "../types/scryfallCard";
import { getFaceImage, isMultiCard } from "../utils/scryfall";
import styles from "./DrawerCardTile.module.css";

const HOLD_MS = 1000;

const AwakeCtx = createContext<{
  awake: string | null;
  wake: (id: string) => void;
  scheduleSleep: (id: string) => void;
}>({
  awake: null,
  wake: () => {},
  scheduleSleep: () => {},
});

export function DrawerTileField({ children }: { children: ReactNode }) {
  const [awake, setAwake] = useState<string | null>(null);
  const holdRef = useRef<number | null>(null);

  function clearHold() {
    if (holdRef.current) {
      window.clearTimeout(holdRef.current);
      holdRef.current = null;
    }
  }

  function wake(id: string) {
    clearHold();
    setAwake(id);
  }

  function scheduleSleep(id: string) {
    clearHold();
    holdRef.current = window.setTimeout(() => {
      setAwake((cur) => (cur === id ? null : cur));
      holdRef.current = null;
    }, HOLD_MS);
  }

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      const t = e.target as HTMLElement | null;
      if (t?.closest("[data-drawer-field]")) return;
      clearHold();
      setAwake(null);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => () => clearHold(), []);

  return (
    <AwakeCtx.Provider value={{ awake, wake, scheduleSleep }}>
      <div data-drawer-field="1">{children}</div>
    </AwakeCtx.Provider>
  );
}

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
  const id = useId();
  const { awake, wake: wakeField, scheduleSleep: sleepField } =
    useContext(AwakeCtx);
  const open = awake === id;
  const faceRef = useRef<HTMLButtonElement | null>(null);
  const [tilt, setTilt] = useState<{
    rx: number;
    ry: number;
    gx: number;
    gy: number;
  } | null>(null);
  const [scry, setScry] = useState<ScryfallCard | null>(null);
  const [face, setFace] = useState<"front" | "back">("front");
  const [prefFront, setPrefFront] = useState<string | null>(null);
  const [prefBack, setPrefBack] = useState<string | null>(null);
  const { resolveImageUrl, preferredPrintings, artRevision } =
    useArtPreferences();
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    const pref = preferredPrintings.get(card.oracle_id);
    if (pref) {
      setScry(pref);
      return;
    }
    if (!card.scryfall_id) return;
    let cancel = false;
    void fetchCardById(card.scryfall_id).then(({ card: c }) => {
      if (!cancel && c) setScry(c);
    });
    return () => {
      cancel = true;
    };
  }, [card.scryfall_id, card.oracle_id, preferredPrintings, artRevision]);

  useEffect(() => {
    let cancel = false;
    void (async () => {
      const front = await resolveImageUrl(card.oracle_id, card.scryfall_id, 0);
      const back = await resolveImageUrl(card.oracle_id, card.scryfall_id, 1);
      if (cancel) return;
      setPrefFront(front);
      setPrefBack(back);
    })();
    return () => {
      cancel = true;
    };
  }, [card.oracle_id, card.scryfall_id, resolveImageUrl, artRevision]);

  const multi = scry ? isMultiCard(scry) : false;
  const front =
    prefFront || (scry ? getFaceImage(scry, 0) : card.image_url);
  const back = prefBack || (scry ? getFaceImage(scry, 1) : null);
  const shown = face === "back" && back ? back : front;

  function wake() {
    setHovered(true);
    wakeField(id);
  }

  function scheduleSleep() {
    setHovered(false);
    setTilt(null);
    sleepField(id);
  }

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

  const tiltStyle: CSSProperties | undefined = open
    ? hovered && tilt
      ? {
          transform: `perspective(900px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg) scale3d(1.04, 1.04, 1.04)`,
          ["--glare-x" as string]: `${tilt.gx}%`,
          ["--glare-y" as string]: `${tilt.gy}%`,
        }
      : {
          transform:
            "perspective(900px) rotateX(0deg) rotateY(0deg) scale3d(1.04, 1.04, 1.04)",
        }
    : undefined;

  return (
    <div
      className={`${styles.tile}${open ? ` ${styles.tileLive}` : ""}`}
      onPointerEnter={wake}
      onPointerMove={onMove}
      onPointerLeave={scheduleSleep}
    >
      <Link
        className={`${styles.slide} ${styles.nameSlide}`}
        to={card.scryfall_id ? `/card/${card.scryfall_id}` : "#"}
        onClick={(e) => {
          if (!card.scryfall_id) e.preventDefault();
        }}
      >
        Card Page
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
          ↑
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
          ↓
        </button>
      </div>

      {multi && back && (
        <button
          type="button"
          className={`${styles.slide} ${styles.flipSlide}`}
          onClick={(e) => {
            e.stopPropagation();
            setFace((f) => (f === "front" ? "back" : "front"));
          }}
        >
          Flip
        </button>
      )}

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
        className={`${styles.artBtn}${open ? ` ${styles.artAwake}` : ""}`}
        style={tiltStyle}
        onClick={onOpen}
        aria-label={card.name}
      >
        {shown ? (
          <img src={shown} alt="" className={styles.art} />
        ) : (
          <span className={styles.fallback}>{card.name}</span>
        )}
        {open && <span className={styles.glare} aria-hidden />}
        {showTierMark && (
          <span className={styles.ear} aria-label={`Tier ${card.tier ?? 1}`}>
            {card.tier ?? 1}
          </span>
        )}
      </button>
    </div>
  );
}
