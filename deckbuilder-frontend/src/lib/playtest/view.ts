import { reducePlay } from "./engine";
import type { PlayAction, PlayCard, PlayZone, PublicCard, SeatView, TableJournal, TableState } from "./types";

const SNAPSHOT_EVERY = 25;

export function emptyJournal(state: TableState): TableJournal {
  return { seq: 0, actions: [], snapshots: [{ seq: 0, state }] };
}

export function recordAction(journal: TableJournal, action: PlayAction, next: TableState): TableJournal {
  if (action.type === "hydrate") return journal;
  const seq = journal.seq + 1;
  const actions = [...journal.actions, action];
  const snapshots =
    seq % SNAPSHOT_EVERY === 0
      ? [...journal.snapshots, { seq, state: next }]
      : journal.snapshots;
  return { seq, actions, snapshots };
}

export function truncateJournal(journal: TableJournal, state: TableState): TableJournal {
  if (!journal.actions.length) return { ...journal, snapshots: [{ seq: journal.seq, state }] };
  const actions = journal.actions.slice(0, -1);
  const seq = Math.max(0, journal.seq - 1);
  const snapshots = journal.snapshots.filter((s) => s.seq <= seq);
  if (!snapshots.length || snapshots[snapshots.length - 1].seq !== seq) {
    snapshots.push({ seq, state });
  } else {
    snapshots[snapshots.length - 1] = { seq, state };
  }
  return { seq, actions, snapshots };
}

export function replayJournal(journal: TableJournal): TableState | null {
  const snap = [...journal.snapshots].reverse().find((s) => s.seq <= journal.seq);
  if (!snap) return null;
  let state = snap.state;
  const pending = journal.actions.slice(snap.seq);
  for (const action of pending) state = reducePlay(state, action);
  return state;
}

function pub(card: PlayCard, zone: PlayZone, hidden: boolean): PublicCard {
  return {
    instanceId: card.instanceId,
    name: hidden ? "Card" : card.name,
    image: hidden || card.facedown ? undefined : card.image,
    tapped: card.tapped,
    facedown: card.facedown || hidden,
    token: card.token,
    ownerSeat: card.ownerSeat,
    controllerSeat: card.controllerSeat || card.ownerSeat,
    zone,
    hidden,
  };
}

/** Fogged projection. The host keeps TableState; a seat renders this. */
export function project(table: TableState, viewerSeat: string): SeatView {
  const you = table.seats.find((s) => s.id === viewerSeat) ?? table.seats[0];
  const others = table.seats
    .filter((s) => s.id !== you.id)
    .map((s) => {
      const reveal = table.libraryReveal?.[s.id] ?? "hidden";
      const top = s.zones.library[0];
      const showTop = reveal === "all" && top;
      return {
        id: s.id,
        name: s.name,
        life: s.life,
        poison: s.poison,
        hand: s.zones.hand.length,
        library: s.zones.library.length,
        graveyard: s.zones.graveyard.length,
        exile: s.zones.exile.length,
        command: s.zones.command.length,
        battlefield: s.zones.battlefield.map((c) => pub(c, "battlefield", c.facedown)),
        revealedTop: showTop ? pub(top, "library", false) : undefined,
      };
    });
  const battlefield: PublicCard[] = [];
  const graveyard: PublicCard[] = [];
  const exile: PublicCard[] = [];
  const command: PublicCard[] = [];
  for (const s of table.seats) {
    battlefield.push(...s.zones.battlefield.map((c) => pub(c, "battlefield", c.facedown)));
    graveyard.push(...s.zones.graveyard.map((c) => pub(c, "graveyard", false)));
    exile.push(...s.zones.exile.map((c) => pub(c, "exile", false)));
    command.push(...s.zones.command.map((c) => pub(c, "command", false)));
  }
  return { viewerSeat: you.id, you, others, publicZones: { battlefield, graveyard, exile, command } };
}
