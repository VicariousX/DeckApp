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
import { useIsMobile } from "../hooks/useIsMobile";
import { useArtPreferences } from "../auth/ArtPreferencesProvider";
import { fetchCardById } from "../lib/scryfallApi";
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

/** One awake tile at a time. Wrap a grid of CardTiles. */
export function CardTileField({ children }: { children: ReactNode }) {
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
      if (t?.closest("[data-card-field]")) return;
      clearHold();
      setAwake(null);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => () => clearHold(), []);

  return (
    <AwakeCtx.Provider value={{ awake, wake, scheduleSleep }}>
      <div data-card-field="1" data-drawer-field="1">{children}</div>
    </AwakeCtx.Provider>
  );
}

export type TileFace = {
  name: string;
  imageUrl?: string | null;
  scryfallId?: string | null;
  oracleId?: string | null;
};

type Props = {
  face: TileFace;
  /** Corner mark (tier, quantity, check). */
  ear?: ReactNode;
  onOpen: () => void;
  onContextMenu?: (e: { preventDefault: () => void; clientX: number; clientY: number }) => void;
  /** Top slide. Defaults to a Card Page link when scryfallId is set. */
  top?: ReactNode;
  /** Right-edge slides, top to bottom. */
  right?: ReactNode[];
  /** Bottom slide. */
  bottom?: ReactNode;
  /** When true, resolve preferred/custom art. Pass a ready imageUrl to skip the fetch. */
  resolveArt?: boolean;
};

export function CardTile({
  face,
  ear,
  onOpen,
  onContextMenu,
  top,
  right,
  bottom,
  resolveArt = true,
}: Props) {
  const id = useId();
  const isMobile = useIsMobile();
  const { awake, wake: wakeField, scheduleSleep: sleepField } = useContext(AwakeCtx);
  const open = awake === id;
  const faceRef = useRef<HTMLButtonElement | null>(null);
  const [tilt, setTilt] = useState<{ rx: number; ry: number; gx: number; gy: number } | null>(null);
  const [hovered, setHovered] = useState(false);
  const [shownFace, setShownFace] = useState<"front" | "back">("front");
  const [prefFront, setPrefFront] = useState<string | null>(null);
  const [prefBack, setPrefBack] = useState<string | null>(null);
  const [multi, setMulti] = useState(false);
  const { resolveImageUrl, preferredPrintings, artRevision } = useArtPreferences();

  useEffect(() => {
    if (!resolveArt) return;
    const oracle = face.oracleId;
    const scry = face.scryfallId;
    if (!oracle && !scry) return;
    let cancel = false;
    void (async () => {
      const front = await resolveImageUrl(oracle ?? scry ?? "", scry, 0);
      const back = await resolveImageUrl(oracle ?? scry ?? "", scry, 1);
      if (cancel) return;
      setPrefFront(front);
      setPrefBack(back);
    })();
    const pref = oracle ? preferredPrintings.get(oracle) : undefined;
    if (pref) setMulti(isMultiCard(pref));
    else if (scry) {
      void fetchCardById(scry).then(({ card }) => {
        if (!cancel && card) setMulti(isMultiCard(card));
      });
    }
    return () => {
      cancel = true;
    };
  }, [face.oracleId, face.scryfallId, resolveArt, resolveImageUrl, preferredPrintings, artRevision]);

  const front = prefFront || face.imageUrl || "";
  const back = prefBack || "";
  const shown = shownFace === "back" && back ? back : front;

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
          transform: "perspective(900px) rotateX(0deg) rotateY(0deg) scale3d(1.04, 1.04, 1.04)",
        }
    : undefined;

  const topNode =
    top ??
    (face.scryfallId ? (
      <Link className={`${styles.slide} ${styles.nameSlide}`} to={`/card/${face.scryfallId}`}>
        Card Page
      </Link>
    ) : null);

  return (
    <div
      className={`${styles.tile}${open ? ` ${styles.tileLive}` : ""}`}
      onPointerEnter={wake}
      onPointerMove={onMove}
      onPointerLeave={scheduleSleep}
      onContextMenu={(e) => {
        if (!onContextMenu) return;
        e.preventDefault();
        onContextMenu(e);
      }}
    >
      {!isMobile && topNode}
      {!isMobile && right?.map((node, i) => (
        <div key={i} className={`${styles.slide} ${styles.tierSlide}`} style={{ top: `${8 + i * 28}%` }}>
          {node}
        </div>
      ))}
      {!isMobile && multi && back && (
        <button
          type="button"
          className={`${styles.slide} ${styles.flipSlide}`}
          onClick={(e) => {
            e.stopPropagation();
            setShownFace((f) => (f === "front" ? "back" : "front"));
          }}
        >
          Flip
        </button>
      )}
      {!isMobile && bottom && <div className={`${styles.slide} ${styles.removeSlide}`}>{bottom}</div>}
      <button
        ref={faceRef}
        type="button"
        className={`${styles.artBtn}${open ? ` ${styles.artAwake}` : ""}`}
        style={tiltStyle}
        onClick={onOpen}
        aria-label={face.name}
      >
        {shown ? (
          <img src={shown} alt="" className={styles.art} />
        ) : (
          <span className={styles.fallback}>{face.name}</span>
        )}
        {open && <span className={styles.glare} aria-hidden />}
        {ear != null && ear !== false && (
          <span className={styles.ear} aria-hidden>
            {ear}
          </span>
        )}
      </button>
    </div>
  );
}
