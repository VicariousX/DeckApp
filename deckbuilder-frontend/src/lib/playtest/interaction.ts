import { useCallback, useRef, useState } from "react";
import type { PlayCard, PlayZone } from "./types";

export type LookKind = "scry" | "searchTop" | "cascade" | "discover";
export type InteractionMode = "idle" | "drag" | "marquee" | "menu" | "look" | "enhance";

export type MenuPos = { x: number; y: number; flyLeft?: boolean };

/**
 * Ephemeral UI for a seat. Never persisted, never sent as table truth.
 * Table mutations go through PlayAction; this only tracks selection, menus,
 * peek, enhance, and in-progress look drafts.
 */
export function usePlayInteraction() {
  const [mode, setMode] = useState<InteractionMode>("idle");
  const [selected, setSelected] = useState<string | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [menu, setMenu] = useState<(MenuPos & { card: PlayCard }) | null>(null);
  const [libMenu, setLibMenu] = useState<MenuPos | null>(null);
  const [tableMenu, setTableMenu] = useState<MenuPos | null>(null);
  const [branch, setBranch] = useState<string | null>(null);
  const [enhanceList, setEnhanceList] = useState<PlayCard[]>([]);
  const [hoverCard, setHoverCard] = useState<PlayCard | null>(null);
  const [altPeek, setAltPeek] = useState(false);
  const [searchZone, setSearchZone] = useState<PlayZone | null>(null);
  const [scryN, setScryN] = useState<PlayCard[] | null>(null);
  const [lookKind, setLookKind] = useState<LookKind>("scry");
  const [cascadeHit, setCascadeHit] = useState<string | null>(null);
  const [marquee, setMarquee] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const [libDestOpen, setLibDestOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const lastClickRef = useRef({ id: "", at: 0 });
  const hoverRef = useRef<PlayCard | null>(null);
  const marqueeRef = useRef(marquee);
  marqueeRef.current = marquee;

  const targets = useCallback(
    (id: string) => (picked.includes(id) && picked.length > 1 ? picked : [id]),
    [picked]
  );

  const clearUi = useCallback(() => {
    setMenu(null);
    setLibMenu(null);
    setTableMenu(null);
    setBranch(null);
    setMoveOpen(false);
    setLibDestOpen(false);
    setMode("idle");
  }, []);

  const clearSelection = useCallback(() => {
    setPicked([]);
    setSelected(null);
  }, []);

  const openEnhance = useCallback((cards: PlayCard[]) => {
    setEnhanceList(cards.filter(Boolean));
    setMode(cards.length ? "enhance" : "idle");
  }, []);

  return {
    mode,
    setMode,
    selected,
    setSelected,
    picked,
    setPicked,
    menu,
    setMenu,
    libMenu,
    setLibMenu,
    tableMenu,
    setTableMenu,
    branch,
    setBranch,
    enhanceList,
    setEnhanceList,
    hoverCard,
    setHoverCard,
    altPeek,
    setAltPeek,
    searchZone,
    setSearchZone,
    scryN,
    setScryN,
    lookKind,
    setLookKind,
    cascadeHit,
    setCascadeHit,
    marquee,
    setMarquee,
    libDestOpen,
    setLibDestOpen,
    moveOpen,
    setMoveOpen,
    lastClickRef,
    hoverRef,
    marqueeRef,
    targets,
    clearUi,
    clearSelection,
    openEnhance,
  };
}
