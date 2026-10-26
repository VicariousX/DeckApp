import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthProvider";
import {
  addCardToDeck,
  listDecksContainingOracle,
  listMyDecks,
  type DeckCardPresence,
} from "../../services/deckService";
import { listMembershipsForCard, type MembershipMeasure } from "../../services/membershipService";
import { MembershipList } from "../MembershipList";
import type { Deck, DeckBoard, DeckTag } from "../../types/deck";
import type { CardInspectorDeckControls } from "./types";
import styles from "../CardInspectorModal.module.css";

const BOARDS: { id: DeckBoard; label: string }[] = [
  { id: "commander", label: "Commander" },
  { id: "main", label: "Mainboard" },
  { id: "side", label: "Sideboard" },
  { id: "maybe", label: "Maybeboard" },
];

function DeckTagRows({
  tags,
  assigned,
  isOwner,
  onToggle,
}: {
  tags: DeckTag[];
  assigned: Set<string>;
  isOwner: boolean;
  onToggle: (tag: DeckTag) => void;
}) {
  const nodes = useRef(new Map<string, HTMLButtonElement>());
  const pendingRects = useRef<Map<string, DOMRect> | null>(null);
  const [exitingId, setExitingId] = useState<string | null>(null);
  const [arrivingId, setArrivingId] = useState<string | null>(null);
  const busy = useRef(false);

  useLayoutEffect(() => {
    const firsts = pendingRects.current;
    if (!firsts) return;
    pendingRects.current = null;
    for (const [id, first] of firsts) {
      const node = nodes.current.get(id);
      if (!node) continue;
      const last = node.getBoundingClientRect();
      const dx = first.left - last.left;
      const dy = first.top - last.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;
      node.animate(
        [
          { transform: `translate(${dx}px, ${dy}px)` },
          { transform: "translate(0, 0)" },
        ],
        { duration: 360, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }
      );
    }
  }, [assigned]);

  function handleToggle(tag: DeckTag) {
    if (!isOwner || busy.current) return;
    busy.current = true;
    setExitingId(tag.id);
    window.setTimeout(() => {
      const rects = new Map<string, DOMRect>();
      for (const [id, node] of nodes.current) {
        if (id === tag.id) continue;
        rects.set(id, node.getBoundingClientRect());
      }
      pendingRects.current = rects;
      onToggle(tag);
      setExitingId(null);
      setArrivingId(tag.id);
      window.setTimeout(() => {
        setArrivingId((cur) => (cur === tag.id ? null : cur));
        busy.current = false;
      }, 280);
    }, 280);
  }

  const activeTags = tags.filter((t) => assigned.has(t.id));
  const availableTags = tags.filter((t) => !assigned.has(t.id));

  function chip(tag: DeckTag, on: boolean) {
    return (
      <button
        key={tag.id}
        type="button"
        ref={(n) => {
          if (n) nodes.current.set(tag.id, n);
          else nodes.current.delete(tag.id);
        }}
        className={`${styles.tagChip}${on ? ` ${styles.tagChipOn}` : ""}${
          exitingId === tag.id ? ` ${styles.tagChipExit}` : ""
        }${arrivingId === tag.id ? ` ${styles.tagChipEnter}` : ""}`}
        disabled={!isOwner}
        style={
          on
            ? { borderColor: tag.color, background: `${tag.color}33` }
            : undefined
        }
        onClick={() => handleToggle(tag)}
      >
        <span className={styles.tagLabel}>{tag.name}</span>
      </button>
    );
  }

  return (
    <>
      <div className={styles.tagLane}>
        <span className={styles.extraLabel}>Active tags</span>
        <div className={styles.tagList}>{activeTags.map((t) => chip(t, true))}</div>
      </div>
      <div className={styles.tagLane}>
        <span className={styles.extraLabel}>Available tags</span>
        <div className={styles.tagList}>
          {availableTags.map((t) => chip(t, false))}
        </div>
      </div>
    </>
  );
}

function AddToDeckPanel({
  scryfallId,
  oracleId,
  name,
  typeLine,
}: {
  scryfallId: string;
  oracleId?: string;
  name: string;
  typeLine?: string;
}) {
  const { user } = useAuth();
  const [decks, setDecks] = useState<Deck[] | null>(null);
  const [presence, setPresence] = useState<DeckCardPresence[]>([]);
  const [memberships, setMemberships] = useState<MembershipMeasure[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    void listMyDecks(user.id).then(({ decks: list }) => setDecks(list ?? []));
    const oracle = oracleId || scryfallId;
    void listDecksContainingOracle(user.id, oracle).then(({ rows }) =>
      setPresence(rows)
    );
    void listMembershipsForCard(user.id, {
      oracleId: oracle,
      scryfallId,
      name,
    }).then(setMemberships);
  }, [user, oracleId, scryfallId, name]);

  async function add(deckId: string) {
    setBusy(true);
    const { error } = await addCardToDeck(deckId, {
      oracle_id: oracleId || scryfallId,
      scryfall_id: scryfallId,
      name,
      type_line: typeLine || "",
      quantity: 1,
      board: "maybe",
    });
    setBusy(false);
    setStatus(error ?? "Added to maybeboard");
    if (!error && user) {
      const oracle = oracleId || scryfallId;
      const { rows } = await listDecksContainingOracle(user.id, oracle);
      setPresence(rows);
    }
  }

  if (!user) {
    return <p className={styles.muted}>Sign in to add this card to a deck.</p>;
  }

  return (
    <div className={`${styles.panelScroll} ${styles.panelScrollSolid}`}>
      <p className={styles.extraLabel}>This card is in</p>
      <MembershipList
        memberships={memberships.filter((m) => m.kind === "deck")}
        emptyText="None yet."
        className={styles.addDeckList}
        itemClassName={styles.addDeckBtn}
        nameClassName=""
        measureClassName={styles.muted}
        emptyClassName={styles.muted}
      />
      <p className={styles.extraLabel}>Add {name} to a deck</p>
      {status && <p className={styles.muted}>{status}</p>}
      {!decks && <p className={styles.muted}>Loading decks…</p>}
      {decks?.length === 0 && <p className={styles.muted}>No decks yet.</p>}
      <div className={styles.addDeckList}>
        {decks?.map((d) => (
          <button
            key={d.id}
            type="button"
            className={styles.addDeckBtn}
            disabled={busy}
            onClick={() => void add(d.id)}
          >
            {d.name}
          </button>
        ))}
      </div>
    </div>
  );
}

export function DeckTab({
  deck,
  scryfallId,
  oracleId,
  name,
  typeLine,
  onRemove,
}: {
  deck?: CardInspectorDeckControls;
  scryfallId: string;
  oracleId?: string;
  name: string;
  typeLine?: string;
  onRemove: () => void;
}) {
  const [newTagName, setNewTagName] = useState("");
  const [tagBusy, setTagBusy] = useState(false);
  const assigned = new Set(deck?.card.tag_ids ?? []);

  if (!deck) {
    return (
      <AddToDeckPanel
        scryfallId={scryfallId}
        oracleId={oracleId}
        name={name}
        typeLine={typeLine}
      />
    );
  }

  return (
    <div className={`${styles.panelScroll} ${styles.panelScrollSolid}`}>
      <div className={styles.deckExtras}>
        <div className={`${styles.qtyRow} ${styles.deckGroup}`}>
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
            <span className={styles.qtyValue}>{deck.card.quantity}</span>
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
        <label className={`${styles.boardRow} ${styles.deckGroup}`}>
          <span className={styles.extraLabel}>Board</span>
          <select
            className={styles.boardSelect}
            value={deck.card.board}
            disabled={!deck.isOwner}
            onChange={(e) => deck.onBoard(e.target.value as DeckBoard)}
          >
            {BOARDS.map((b) => (
              <option key={b.id} value={b.id}>
                {b.label}
              </option>
            ))}
          </select>
        </label>
        <div className={`${styles.tagsBlock} ${styles.deckGroup}`}>
          <DeckTagRows
            tags={deck.tags}
            assigned={assigned}
            isOwner={deck.isOwner}
            onToggle={deck.onToggleTag}
          />
          {deck.isOwner && deck.onCreateTag && (
            <form
              className={styles.tagCreate}
              onSubmit={(e) => {
                e.preventDefault();
                const next = newTagName.trim();
                if (!next || tagBusy) return;
                setTagBusy(true);
                void Promise.resolve(deck.onCreateTag!(next)).finally(() => {
                  setNewTagName("");
                  setTagBusy(false);
                });
              }}
            >
              <input
                className={styles.tagCreateInput}
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                placeholder="New tag"
                maxLength={32}
                aria-label="New deck tag"
              />
              <button
                type="submit"
                className={styles.tagCreateBtn}
                disabled={tagBusy || !newTagName.trim()}
              >
                Add
              </button>
            </form>
          )}
        </div>
      </div>
      {deck.isOwner && (
        <div className={styles.deckFooter}>
          <button type="button" className={styles.removeBtn} onClick={onRemove}>
            Remove from deck
          </button>
        </div>
      )}
    </div>
  );
}
