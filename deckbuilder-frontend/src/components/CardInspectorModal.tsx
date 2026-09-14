import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { fetchCardById } from "../lib/scryfallApi";
import type { DeckBoard, DeckCard, DeckTag } from "../types/deck";
import type { ScryfallCard } from "../types/scryfallCard";
import { getFaceImage, isMultiCard } from "../utils/scryfall";
import { CardDetail } from "./CardDetail";
import { CardImage } from "./CardImage";
import { CardArtPanel } from "./CardArtPanel";
import { DrawerPicker } from "./DrawerPicker";
import { Modal } from "./Modal";
import styles from "./CardInspectorModal.module.css";

const BOARDS: { id: DeckBoard; label: string }[] = [
  { id: "commander", label: "Commander" },
  { id: "main", label: "Mainboard" },
  { id: "side", label: "Sideboard" },
  { id: "maybe", label: "Maybeboard" },
];

export type CardInspectorDeckControls = {
  card: DeckCard;
  isOwner: boolean;
  tags: DeckTag[];
  onQty: (delta: number) => void;
  onBoard: (board: DeckBoard) => void;
  onRemove: () => void;
  onToggleTag: (tag: DeckTag) => void;
};

type Props = {
  scryfallId: string;
  name?: string;
  imageUrl?: string;
  /** Optional preferred/custom back face URL (DFC). */
  imageUrlBack?: string;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
  deck?: CardInspectorDeckControls;
};

type TabId = "info" | "deck" | "drawers" | "artwork";

export function CardInspectorModal({
  scryfallId,
  name,
  imageUrl,
  imageUrlBack,
  onClose,
  onPrev,
  onNext,
  hasPrev = false,
  hasNext = false,
  deck,
}: Props) {
  const [scryfall, setScryfall] = useState<ScryfallCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<TabId>("info");
  const [artSub, setArtSub] = useState<"upload" | "prints">("upload");
  const [contentKey, setContentKey] = useState(0);

  const tabs = useMemo(() => {
    const list: { id: TabId; label: string }[] = [{ id: "info", label: "Info" }];
    if (deck) list.push({ id: "deck", label: "Deck" });
    list.push({ id: "drawers", label: "Drawers" }, { id: "artwork", label: "Artwork" });
    return list;
  }, [deck]);

  const activeIndex = Math.max(
    0,
    tabs.findIndex((t) => t.id === active)
  );

  useEffect(() => {
    // Keep active tab valid when deck controls appear/disappear
    if (!tabs.some((t) => t.id === active)) setActive("info");
  }, [tabs, active]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      const { card: c, error: err } = await fetchCardById(scryfallId);
      if (cancelled) return;
      if (err || !c) {
        setError(err ?? "Could not load card details.");
        setScryfall(null);
        setLoading(false);
        return;
      }
      setScryfall(c);
      setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [scryfallId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "ArrowLeft" && hasPrev && onPrev) {
        e.preventDefault();
        onPrev();
        return;
      }
      if (e.key === "ArrowRight" && hasNext && onNext) {
        e.preventDefault();
        onNext();
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        const next = Math.max(0, activeIndex - 1);
        selectTab(tabs[next].id);
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        const next = Math.min(tabs.length - 1, activeIndex + 1);
        selectTab(tabs[next].id);
        return;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hasPrev, hasNext, onPrev, onNext, onClose, activeIndex, tabs]);

  function selectTab(id: TabId) {
    if (id === active) return;
    setActive(id);
    setContentKey((k) => k + 1);
  }

  const displayName = scryfall?.name ?? name ?? "Card";
  const assigned = new Set(deck?.card.tag_ids ?? []);
  const multi = scryfall ? isMultiCard(scryfall) : false;
  // Preferred printing is the fetched card when scryfallId points at that printing;
  // use its back face unless a custom back URL is provided.
  const backSrc =
    imageUrlBack ||
    (scryfall && multi ? getFaceImage(scryfall, 1) || undefined : undefined);

  function handleRemove() {
    if (!deck) return;
    deck.onRemove();
    if (hasNext && onNext) onNext();
    else onClose();
  }

  const above = tabs.slice(0, activeIndex);
  const below = tabs.slice(activeIndex + 1);

  return (
    <Modal onClose={onClose} hideClose>
      <div className={styles.shell}>
        {(hasPrev || hasNext) && (
          <div className={styles.navRow}>
            <button
              type="button"
              className={styles.navBtn}
              disabled={!hasPrev}
              onClick={onPrev}
              aria-label="Previous card"
            >
              ← Prev
            </button>
            <span className={styles.navHint}>↑↓ tabs · ←→ cards · Esc</span>
            <button
              type="button"
              className={styles.navBtn}
              disabled={!hasNext}
              onClick={onNext}
              aria-label="Next card"
            >
              Next →
            </button>
          </div>
        )}

        <div className={styles.layout}>
          <div className={styles.visual}>
            {loading && (
              <div className={styles.imagePlaceholder}>Loading…</div>
            )}
            {!loading && scryfall && (
              <CardImage
                card={scryfall}
                overrideFrontSrc={imageUrl}
                overrideBackSrc={backSrc}
                bothLayout="stack"
              />
            )}
            {!loading && !scryfall && (
              imageUrl ? (
                <img
                  src={imageUrl}
                  alt={displayName}
                  className={styles.image}
                />
              ) : (
                <div className={styles.imagePlaceholder}>{displayName}</div>
              )
            )}
          </div>

          <div className={styles.body}>
            {above.length > 0 && (
              <div className={styles.tabRail} role="tablist" aria-label="Sections above">
                {above.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    aria-selected={false}
                    className={styles.tabPill}
                    onClick={() => selectTab(t.id)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            )}

            <div
              key={contentKey}
              className={styles.tabPanel}
              role="tabpanel"
              aria-label={tabs[activeIndex]?.label}
            >
              <div className={styles.tabPanelTitle}>
                {tabs[activeIndex]?.label}
              </div>

              {active === "info" && (
                <div className={styles.panelScroll}>
                  {error && (
                    <p className={styles.error} role="alert">
                      {error}
                    </p>
                  )}
                  {scryfall && (
                    <CardDetail
                      card={scryfall}
                      hidePrintingMeta={Boolean(imageUrl)}
                    />
                  )}
                  {!scryfall && !loading && (
                    <h2 className={styles.fallbackTitle}>{displayName}</h2>
                  )}
                  <Link
                    to={`/card/${scryfallId}`}
                    className={styles.detailLink}
                    onClick={onClose}
                  >
                    Open card page →
                  </Link>
                </div>
              )}

              {active === "deck" && deck && (
                <div className={styles.panelScroll}>
                  <div className={styles.deckExtras}>
                    <div className={styles.qtyRow}>
                      <span className={styles.extraLabel}>Quantity</span>
                      <div className={styles.qtyControls}>
                        <button
                          type="button"
                          className={styles.qtyBtn}
                          disabled={!deck.isOwner}
                          onClick={() => deck.onQty(-1)}
                        >
                          −
                        </button>
                        <span className={styles.qtyValue}>
                          {deck.card.quantity}
                        </span>
                        <button
                          type="button"
                          className={styles.qtyBtn}
                          disabled={!deck.isOwner}
                          onClick={() => deck.onQty(1)}
                        >
                          +
                        </button>
                      </div>
                    </div>

                    <label className={styles.boardRow}>
                      <span className={styles.extraLabel}>Board</span>
                      <select
                        className={styles.boardSelect}
                        value={deck.card.board}
                        disabled={!deck.isOwner}
                        onChange={(e) =>
                          deck.onBoard(e.target.value as DeckBoard)
                        }
                      >
                        {BOARDS.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    {deck.tags.length > 0 && (
                      <div className={styles.tagsBlock}>
                        <span className={styles.extraLabel}>Deck tags</span>
                        <div className={styles.tagList}>
                          {deck.tags.map((tag) => {
                            const on = assigned.has(tag.id);
                            return (
                              <button
                                key={tag.id}
                                type="button"
                                className={`${styles.tagChip}${
                                  on ? ` ${styles.tagChipOn}` : ""
                                }`}
                                disabled={!deck.isOwner}
                                style={
                                  on
                                    ? {
                                        borderColor: tag.color,
                                        background: `${tag.color}33`,
                                      }
                                    : undefined
                                }
                                onClick={() => deck.onToggleTag(tag)}
                              >
                                {tag.name}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {deck.isOwner && (
                      <button
                        type="button"
                        className={styles.removeBtn}
                        onClick={handleRemove}
                      >
                        Remove from deck
                      </button>
                    )}
                  </div>
                </div>
              )}

              {active === "drawers" && (
                <div className={styles.panelScroll}>
                  {scryfall ? (
                    <DrawerPicker
                      oracleId={(scryfall.oracle_id ?? scryfall.id).toLowerCase()}
                      scryfallCard={scryfall}
                    />
                  ) : (
                    <p className={styles.muted}>Load card to manage drawers.</p>
                  )}
                </div>
              )}

              {active === "artwork" && (
                <div className={styles.panelScroll}>
                  <div className={styles.subTabRail} role="tablist" aria-label="Artwork">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={artSub === "upload"}
                      className={`${styles.subTab}${
                        artSub === "upload" ? ` ${styles.subTabActive}` : ""
                      }`}
                      onClick={() => setArtSub("upload")}
                    >
                      Upload
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={artSub === "prints"}
                      className={`${styles.subTab}${
                        artSub === "prints" ? ` ${styles.subTabActive}` : ""
                      }`}
                      onClick={() => setArtSub("prints")}
                    >
                      Printings
                    </button>
                  </div>
                  {scryfall ? (
                    <CardArtPanel
                      card={scryfall}
                      embedded
                      forceSub={artSub}
                    />
                  ) : (
                    <p className={styles.muted}>Load card to edit art.</p>
                  )}
                </div>
              )}
            </div>

            {below.length > 0 && (
              <div className={styles.tabRail} role="tablist" aria-label="Sections below">
                {below.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    aria-selected={false}
                    className={styles.tabPill}
                    onClick={() => selectTab(t.id)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
