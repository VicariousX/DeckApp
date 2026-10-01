import type { DeckCard, DeckDetail } from "../../types/deck";
import type {
  PlayAction,
  PlayCard,
  PlayZone,
  SeatState,
  TableState,
} from "./types";

const ZONES: PlayZone[] = [
  "library",
  "hand",
  "battlefield",
  "graveyard",
  "exile",
  "command",
  "sideboard",
  "stack",
];

export function uid(prefix = "p"): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffleInPlace<T>(list: T[], rng: () => number): T[] {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

function emptyZones(): SeatState["zones"] {
  return {
    library: [],
    hand: [],
    battlefield: [],
    graveyard: [],
    exile: [],
    command: [],
    sideboard: [],
    stack: [],
  };
}

function startingLife(format: string): number {
  const f = format.toLowerCase();
  if (f.includes("commander") || f.includes("edh") || f.includes("brawl")) return 40;
  if (f.includes("oathbreaker")) return 20;
  return 20;
}

function expandDeckCards(
  cards: DeckCard[],
  images: Record<string, { front?: string; back?: string }>,
  seatId: string
): { main: PlayCard[]; command: PlayCard[]; side: PlayCard[] } {
  const main: PlayCard[] = [];
  const command: PlayCard[] = [];
  const side: PlayCard[] = [];
  for (const c of cards) {
    if (c.board === "maybe") continue;
    const n = Math.max(1, c.quantity || 1);
    for (let i = 0; i < n; i++) {
      const pc: PlayCard = {
        instanceId: uid("c"),
        oracleId: c.oracle_id,
        scryfallId: c.scryfall_id,
        name: c.name,
        typeLine: c.type_line || "",
        manaCost: c.mana_cost || "",
        cmc: typeof c.cmc === "number" ? c.cmc : undefined,
        image: images[c.scryfall_id]?.front || images[c.id]?.front,
        imageBack: images[c.scryfall_id]?.back || images[c.id]?.back,
        face: 0,
        tapped: false,
        facedown: false,
        counters: {},
        token: false,
        ownerSeat: seatId,
        controllerSeat: seatId,
      };
      if (c.board === "commander") command.push(pc);
      else if (c.board === "side") side.push(pc);
      else main.push(pc);
    }
  }
  return { main, command, side };
}

export function createTableFromDeck(
  detail: DeckDetail,
  images: Record<string, { front?: string; back?: string }>,
  opts?: {
    userId?: string;
    name?: string;
    seed?: number;
    openingHand?: number;
    startingLife?: number;
  }
): TableState {
  const seatId = uid("seat");
  const seed = opts?.seed ?? (Date.now() % 1_000_000_000);
  const rng = mulberry32(seed);
  const expanded = expandDeckCards(detail.cards, images, seatId);
  shuffleInPlace(expanded.main, rng);
  const zones = emptyZones();
  zones.library = expanded.main;
  zones.command = expanded.command;
  zones.sideboard = expanded.side;
  const seat: SeatState = {
    id: seatId,
    userId: opts?.userId,
    name: opts?.name || "You",
    life: opts?.startingLife ?? startingLife(detail.deck.format || ""),
    poison: 0,
    energy: 0,
    experience: 0,
    commanderTax: 0,
    commanderDamage: {},
    zones,
    mulligans: 0,
    maxHand: opts?.openingHand ?? 7,
  };
  const hand = zones.library.splice(0, seat.maxHand);
  zones.hand = hand;
  return {
    id: uid("table"),
    deckId: detail.deck.id,
    deckName: detail.deck.name,
    format: detail.deck.format || "casual",
    seed,
    rngStep: 0,
    libraryReveal: { [seatId]: "hidden" },
    keptHand: { [seatId]: false },
    controlStamp: 0,
    phase: "main",
    turn: 1,
    activeSeat: seatId,
    seats: [seat],
    started: true,
    log: [
      { at: Date.now(), text: `Started playtest of ${detail.deck.name}` },
      { at: Date.now(), text: `Drew opening ${hand.length}` },
    ],
  };
}

function clone<T>(v: T): T {
  return structuredClone(v);
}

function findCard(
  state: TableState,
  instanceId: string
): { seat: SeatState; zone: PlayZone; index: number; card: PlayCard } | null {
  for (const seat of state.seats) {
    for (const zone of ZONES) {
      const index = seat.zones[zone].findIndex((c) => c.instanceId === instanceId);
      if (index >= 0) return { seat, zone, index, card: seat.zones[zone][index] };
    }
  }
  return null;
}

function seatOf(state: TableState, seatId: string): SeatState | undefined {
  return state.seats.find((s) => s.id === seatId);
}

function ownerZones(zone: PlayZone): boolean {
  return zone === "graveyard" || zone === "exile" || zone === "library" || zone === "command";
}

function releaseToOwner(state: TableState, card: PlayCard, fromSeat: SeatState, zone: PlayZone) {
  card.controllerSeat = card.ownerSeat;
  card.controlExpiresTurn = undefined;
  if (zone !== "battlefield" || fromSeat.id === card.ownerSeat) return;
  const idx = fromSeat.zones.battlefield.findIndex((c) => c.instanceId === card.instanceId);
  if (idx < 0) return;
  const [moved] = fromSeat.zones.battlefield.splice(idx, 1);
  const owner = seatOf(state, card.ownerSeat) ?? fromSeat;
  owner.zones.battlefield.push(moved);
}

function applyMove(
  state: TableState,
  card: PlayCard,
  fromSeat: SeatState,
  fromZone: PlayZone,
  to: PlayZone,
  seatId: string,
  index?: number,
  toOwner?: boolean
) {
  if (to !== "battlefield") {
    card.tapped = false;
    card.row = undefined;
    card.x = undefined;
    card.y = undefined;
    card.enteredTurn = undefined;
    card.attachedTo = undefined;
    card.controllerSeat = card.ownerSeat;
    card.controlExpiresTurn = undefined;
  } else if (fromZone !== "battlefield") {
    card.enteredTurn = state.turn;
    if (!card.row) card.row = "field";
  }
  const useOwner = toOwner || ownerZones(to);
  const destId = useOwner ? card.ownerSeat : seatId || card.controllerSeat || card.ownerSeat;
  const destSeat = seatOf(state, destId) ?? fromSeat;
  const dest = destSeat.zones[to];
  const idx = index ?? dest.length;
  dest.splice(Math.max(0, Math.min(idx, dest.length)), 0, card);
}

function pushLog(state: TableState, text: string) {
  state.log = [...state.log.slice(-80), { at: Date.now(), text }];
}

function tableRng(state: TableState) {
  state.rngStep = (state.rngStep ?? 0) + 1;
  return mulberry32((state.seed ^ Math.imul(state.rngStep, 0x9e3779b9)) >>> 0);
}

export function reducePlay(state: TableState, action: PlayAction): TableState {
  if (action.type === "hydrate") {
    return {
      ...action.state,
      rngStep: action.state.rngStep ?? 0,
      libraryReveal: action.state.libraryReveal ?? {},
      controlStamp: action.state.controlStamp ?? 0,
      stackItems: action.state.stackItems ?? [],
      passed: action.state.passed ?? [],
    };
  }
  const next = clone(state);
  if (next.rngStep == null) next.rngStep = 0;
  if (!next.libraryReveal) next.libraryReveal = {};
  if (!next.keptHand) next.keptHand = {};
  if (next.controlStamp == null) next.controlStamp = 0;
  if (!next.stackItems) next.stackItems = [];
  if (!next.passed) next.passed = [];
  for (const s of next.seats) {
    if (s.commanderTax == null) s.commanderTax = 0;
    if (!s.commanderDamage) s.commanderDamage = {};
    for (const zone of ZONES) {
      for (const card of s.zones[zone]) {
        if (!card.controllerSeat) card.controllerSeat = card.ownerSeat || s.id;
        if (!card.ownerSeat) card.ownerSeat = s.id;
      }
    }
  }

  switch (action.type) {
    case "shuffle": {
      const seat = seatOf(next, action.seatId);
      if (!seat) break;
      shuffleInPlace(seat.zones.library, tableRng(next));
      pushLog(next, `${seat.name} shuffled library`);
      break;
    }
    case "draw": {
      const seat = seatOf(next, action.seatId);
      if (!seat) break;
      const n = action.n ?? 1;
      const taken = seat.zones.library.splice(0, n);
      seat.zones.hand.push(...taken);
      pushLog(next, `${seat.name} drew ${taken.length}`);
      break;
    }
    case "mulligan": {
      const seat = seatOf(next, action.seatId);
      if (!seat) break;
      const kind = action.kind ?? "london";
      seat.zones.library.push(...seat.zones.hand);
      seat.zones.hand = [];
      shuffleInPlace(seat.zones.library, tableRng(next));
      seat.mulligans += 1;
      const full = seat.maxHand || 7;
      if (kind === "free") {
        seat.zones.hand = seat.zones.library.splice(0, full);
        pushLog(next, `${seat.name} free-mulliganed to ${full}`);
        break;
      }
      if (kind === "paris") {
        const keep = Math.max(0, full - seat.mulligans);
        seat.zones.hand = seat.zones.library.splice(0, keep);
        pushLog(next, `${seat.name} Paris mulliganed to ${keep}`);
        break;
      }
      const drawn = seat.zones.library.splice(0, full);
      const keep = Math.max(0, full - seat.mulligans);
      seat.zones.hand = drawn.slice(0, keep);
      seat.zones.library.push(...drawn.slice(keep));
      pushLog(next, `${seat.name} London mulliganed to ${keep}`);
      break;
    }
    case "keep": {
      const seat = seatOf(next, action.seatId);
      if (!seat) break;
      next.keptHand = { ...(next.keptHand ?? {}), [seat.id]: true };
      pushLog(next, `${seat.name} kept a hand of ${seat.zones.hand.length}`);
      break;
    }
    case "move": {
      const found = findCard(next, action.instanceId);
      if (!found) break;
      const [card] = found.seat.zones[found.zone].splice(found.index, 1);
      applyMove(next, card, found.seat, found.zone, action.to, action.seatId, action.index, action.toOwner);
      pushLog(next, `${card.name} → ${action.to}`);
      break;
    }
    case "tap": {
      const found = findCard(next, action.instanceId);
      if (!found) break;
      found.card.tapped = action.tapped ?? !found.card.tapped;
      break;
    }
    case "tapMany": {
      const set = new Set(action.instanceIds);
      for (const seat of next.seats) {
        for (const zone of ZONES) {
          for (const card of seat.zones[zone]) {
            if (!set.has(card.instanceId)) continue;
            card.tapped = action.tapped ?? !card.tapped;
          }
        }
      }
      break;
    }
    case "flip": {
      const found = findCard(next, action.instanceId);
      if (!found) break;
      found.card.face = action.face ?? (found.card.face === 0 ? 1 : 0);
      break;
    }
    case "facedown": {
      const found = findCard(next, action.instanceId);
      if (!found) break;
      found.card.facedown = action.facedown ?? !found.card.facedown;
      break;
    }
    case "moveMany": {
      action.instanceIds.forEach((id, i) => {
        const found = findCard(next, id);
        if (!found) return;
        const [card] = found.seat.zones[found.zone].splice(found.index, 1);
        applyMove(
          next,
          card,
          found.seat,
          found.zone,
          action.to,
          action.seatId,
          action.index != null ? action.index + i : undefined,
          action.toOwner
        );
      });
      if (action.instanceIds.length) pushLog(next, `${action.instanceIds.length} cards → ${action.to}`);
      break;
    }
    case "ensureSeat": {
      const name = action.name.trim() || "Opponent";
      if (!next.seats.some((s) => s.name === name)) {
        const id = uid("seat");
        next.seats.push({
          id,
          name,
          life: startingLife(next.format),
          poison: 0,
          energy: 0,
          experience: 0,
          commanderTax: 0,
          commanderDamage: {},
          zones: emptyZones(),
          mulligans: 0,
          maxHand: 7,
        });
        next.libraryReveal[id] = "hidden";
        pushLog(next, `${name} joined the table`);
      }
      break;
    }
    case "gainControl": {
      const found = findCard(next, action.instanceId);
      if (!found) break;
      let dest = seatOf(next, action.seatId);
      if (!dest && action.seatId === "opponent") {
        dest = next.seats.find((s) => s.name === "Opponent");
        if (!dest) {
          const id = uid("seat");
          dest = {
            id,
            name: "Opponent",
            life: startingLife(next.format),
            poison: 0,
            energy: 0,
            experience: 0,
            commanderTax: 0,
            commanderDamage: {},
            zones: emptyZones(),
            mulligans: 0,
            maxHand: 7,
          };
          next.seats.push(dest);
          next.libraryReveal[id] = "hidden";
        }
      }
      if (!dest) break;
      const [card] = found.seat.zones[found.zone].splice(found.index, 1);
      next.controlStamp = (next.controlStamp ?? 0) + 1;
      card.controllerSeat = dest.id;
      card.timestamp = next.controlStamp;
      card.controlExpiresTurn = action.untilEndOfTurn ? next.turn : undefined;
      if (found.zone === "battlefield") {
        if (!card.row) card.row = "field";
        dest.zones.battlefield.push(card);
      } else {
        found.seat.zones[found.zone].splice(found.index, 0, card);
      }
      pushLog(
        next,
        `${dest.name} controls ${card.name}${action.untilEndOfTurn ? " until end of turn" : ""}`
      );
      break;
    }
    case "releaseControl": {
      const found = findCard(next, action.instanceId);
      if (!found) break;
      const [card] = found.seat.zones[found.zone].splice(found.index, 1);
      const owner = seatOf(next, card.ownerSeat) ?? found.seat;
      card.controllerSeat = owner.id;
      card.controlExpiresTurn = undefined;
      next.controlStamp = (next.controlStamp ?? 0) + 1;
      card.timestamp = next.controlStamp;
      if (found.zone === "battlefield") owner.zones.battlefield.push(card);
      else owner.zones[found.zone].push(card);
      pushLog(next, `${card.name} returned to ${owner.name}`);
      break;
    }
    case "removeMany": {
      for (const id of action.instanceIds) {
        const found = findCard(next, id);
        if (!found) continue;
        found.seat.zones[found.zone].splice(found.index, 1);
      }
      if (action.instanceIds.length) pushLog(next, `Removed ${action.instanceIds.length} cards`);
      break;
    }
    case "cloneMany": {
      for (const id of action.instanceIds) {
        const found = findCard(next, id);
        if (!found) continue;
        found.seat.zones.battlefield.push({
          ...structuredClone(found.card),
          instanceId: uid("tok"),
          token: true,
          ownerSeat: found.card.controllerSeat || found.seat.id,
          controllerSeat: found.card.controllerSeat || found.seat.id,
          tapped: false,
          attachedTo: undefined,
          enteredTurn: next.turn,
          x: found.card.x != null ? found.card.x + 3 : undefined,
          y: found.card.y != null ? found.card.y + 3 : undefined,
        });
      }
      if (action.instanceIds.length) pushLog(next, `Token copies ×${action.instanceIds.length}`);
      break;
    }
    case "stackDelta": {
      const found = findCard(next, action.instanceId);
      if (!found) break;
      if (action.delta > 0) {
        for (let i = 0; i < action.delta; i += 1) {
          found.seat.zones.battlefield.push({
            ...structuredClone(found.card),
            instanceId: uid("tok"),
            token: true,
            attachedTo: undefined,
            x: found.card.x,
            y: found.card.y,
            enteredTurn: found.card.enteredTurn ?? next.turn,
          });
        }
        pushLog(next, `${found.card.name} ×${action.delta} added`);
      } else if (action.delta < 0) {
        const want = Math.abs(action.delta);
        const key = `${found.card.oracleId}|${found.card.tapped}|${found.card.facedown}|${found.card.enteredTurn ?? ""}|${JSON.stringify(found.card.counters)}`;
        const matches = found.seat.zones.battlefield.filter(
          (c) =>
            c.token &&
            `${c.oracleId}|${c.tapped}|${c.facedown}|${c.enteredTurn ?? ""}|${JSON.stringify(c.counters)}` === key
        );
        const cut = matches.slice(-want);
        const ids = new Set(cut.map((c) => c.instanceId));
        found.seat.zones.battlefield = found.seat.zones.battlefield.filter((c) => !ids.has(c.instanceId));
        pushLog(next, `Removed ${cut.length} ${found.card.name}`);
      }
      break;
    }
    case "attach": {
      for (const id of action.instanceIds) {
        if (id === action.to) continue;
        const found = findCard(next, id);
        if (!found) continue;
        found.card.attachedTo = action.to ?? undefined;
        if (action.to) {
          const host = findCard(next, action.to);
          if (host && host.card.x != null) {
            found.card.x = host.card.x + 2;
            found.card.y = (host.card.y ?? 0) + 6;
            found.card.row = host.card.row ?? "field";
          }
        }
      }
      break;
    }
    case "revealTop": {
      next.libraryReveal[action.seatId] = action.mode;
      const seat = seatOf(next, action.seatId);
      if (seat) {
        pushLog(
          next,
          action.mode === "hidden"
            ? `${seat.name} hid the top of the library`
            : `${seat.name} revealed the top of the library (${action.mode})`
        );
      }
      break;
    }
    case "bottomRandom": {
      const seat = seatOf(next, action.seatId);
      if (!seat) break;
      const set = new Set(action.instanceIds);
      const moving = seat.zones.library.filter((c) => set.has(c.instanceId));
      seat.zones.library = seat.zones.library.filter((c) => !set.has(c.instanceId));
      shuffleInPlace(moving, tableRng(next));
      seat.zones.library.push(...moving);
      pushLog(next, `${seat.name} put ${moving.length} on the bottom (random)`);
      break;
    }
    case "counter": {
      const found = findCard(next, action.instanceId);
      if (!found) break;
      const cur = found.card.counters[action.key] ?? 0;
      const nextVal = cur + action.delta;
      if (nextVal === 0) delete found.card.counters[action.key];
      else found.card.counters[action.key] = nextVal;
      break;
    }
    case "counterMany": {
      for (const id of action.instanceIds) {
        const found = findCard(next, id);
        if (!found) continue;
        const cur = found.card.counters[action.key] ?? 0;
        const nextVal = cur + action.delta;
        if (nextVal === 0) delete found.card.counters[action.key];
        else found.card.counters[action.key] = nextVal;
      }
      break;
    }
    case "proliferate": {
      const seat = seatOf(next, action.seatId);
      if (!seat) break;
      let n = 0;
      for (const c of seat.zones.battlefield) {
        for (const [k, v] of Object.entries(c.counters)) {
          if (v > 0) {
            c.counters[k] = v + 1;
            n += 1;
          }
        }
      }
      if (seat.poison > 0) seat.poison += 1;
      if (seat.energy > 0) seat.energy += 1;
      if (seat.experience > 0) seat.experience += 1;
      pushLog(next, `${seat.name} proliferated${n ? ` (${n} counters)` : ""}`);
      break;
    }
    case "tax": {
      const seat = seatOf(next, action.seatId);
      if (!seat) break;
      seat.commanderTax = Math.max(0, (seat.commanderTax ?? 0) + action.delta);
      pushLog(next, `${seat.name} commander tax ${seat.commanderTax}`);
      break;
    }
    case "cmdDamage": {
      const seat = seatOf(next, action.seatId);
      if (!seat) break;
      const cur = seat.commanderDamage[action.from] ?? 0;
      seat.commanderDamage[action.from] = Math.max(0, cur + action.delta);
      pushLog(next, `${seat.name} commander damage ${seat.commanderDamage[action.from]}`);
      break;
    }
    case "align": {
      const cards = action.instanceIds
        .map((id) => findCard(next, id)?.card)
        .filter((c): c is PlayCard => Boolean(c));
      if (!cards.length) break;
      const startX = cards[0].x ?? 4;
      const startY = cards[0].y ?? 8;
      cards.forEach((c, i) => {
        c.x = startX + i * 8;
        c.y = startY;
        c.row = "field";
      });
      break;
    }
    case "sortHand": {
      const seat = seatOf(next, action.seatId);
      if (!seat) break;
      seat.zones.hand.sort((a, b) => {
        if (action.by === "type") return (a.typeLine || "").localeCompare(b.typeLine || "") || a.name.localeCompare(b.name);
        if (action.by === "name") return a.name.localeCompare(b.name);
        return (a.cmc ?? 0) - (b.cmc ?? 0) || a.name.localeCompare(b.name);
      });
      pushLog(next, `${seat.name} sorted hand by ${action.by}`);
      break;
    }
    case "life": {
      const seat = seatOf(next, action.seatId);
      if (!seat) break;
      seat.life += action.delta;
      pushLog(next, `${seat.name} life ${action.delta > 0 ? "+" : ""}${action.delta} (${seat.life})`);
      break;
    }
    case "stat": {
      const seat = seatOf(next, action.seatId);
      if (!seat) break;
      seat[action.key] = Math.max(0, seat[action.key] + action.delta);
      break;
    }
    case "untapAll": {
      const seat = seatOf(next, action.seatId);
      if (!seat) break;
      for (const c of seat.zones.battlefield) c.tapped = false;
      break;
    }
    case "nextTurn": {
      const seat = seatOf(next, next.activeSeat);
      const doUntap = action.untap !== false;
      const drawN = action.draw ?? 1;
      for (const s of next.seats) {
        for (const zone of ZONES) {
          for (const card of [...s.zones[zone]]) {
            if (card.controlExpiresTurn != null && card.controlExpiresTurn <= next.turn) {
              releaseToOwner(next, card, s, zone);
            }
          }
        }
      }
      if (seat) {
        if (doUntap) for (const c of seat.zones.battlefield) c.tapped = false;
        const drawn = drawN > 0 ? seat.zones.library.splice(0, drawN) : [];
        seat.zones.hand.push(...drawn);
        pushLog(
          next,
          `Turn ${next.turn + 1}${doUntap ? ": untap" : ""}${drawN ? ` + draw ${drawn.length}` : ""}`
        );
      }
      next.turn += 1;
      break;
    }
    case "mill": {
      const seat = seatOf(next, action.seatId);
      if (!seat) break;
      const milled = seat.zones.library.splice(0, action.n);
      seat.zones.graveyard.push(...milled);
      pushLog(next, `${seat.name} milled ${milled.length}`);
      break;
    }
    case "scry": {
      const seat = seatOf(next, action.seatId);
      if (!seat) break;
      const grave = action.grave ?? [];
      const byId = new Map(seat.zones.library.map((c) => [c.instanceId, c]));
      const rest = seat.zones.library.filter(
        (c) =>
          !action.keepTop.includes(c.instanceId) &&
          !action.bottom.includes(c.instanceId) &&
          !grave.includes(c.instanceId)
      );
      seat.zones.library = [
        ...action.keepTop.map((id) => byId.get(id)!).filter(Boolean),
        ...rest,
        ...action.bottom.map((id) => byId.get(id)!).filter(Boolean),
      ];
      for (const id of grave) {
        const card = byId.get(id);
        if (card) seat.zones.graveyard.push(card);
      }
      pushLog(next, grave.length ? `${seat.name} surveiled` : `${seat.name} scried`);
      break;
    }
    case "place": {
      const found = findCard(next, action.instanceId);
      if (!found) break;
      if (action.x != null) found.card.x = action.x;
      if (action.y != null) found.card.y = action.y;
      if (action.row) found.card.row = action.row;
      break;
    }
    case "addToken": {
      const seat = seatOf(next, action.seatId);
      if (!seat) break;
      seat.zones.battlefield.push({
        ...action.card,
        instanceId: uid("tok"),
        ownerSeat: seat.id,
        controllerSeat: seat.id,
        token: true,
        enteredTurn: next.turn,
      });
      pushLog(next, `${seat.name} created ${action.card.name}`);
      break;
    }
    case "remove": {
      const found = findCard(next, action.instanceId);
      if (!found) break;
      found.seat.zones[found.zone].splice(found.index, 1);
      pushLog(next, `Removed ${found.card.name}`);
      break;
    }
    case "clone": {
      const found = findCard(next, action.instanceId);
      if (!found) break;
      const copy: PlayCard = {
        ...structuredClone(found.card),
        instanceId: uid("tok"),
        token: true,
        ownerSeat: found.card.controllerSeat || found.seat.id,
        controllerSeat: found.card.controllerSeat || found.seat.id,
        tapped: false,
        attachedTo: undefined,
        enteredTurn: next.turn,
        x: found.card.x != null ? found.card.x + 3 : undefined,
        y: found.card.y != null ? found.card.y + 3 : undefined,
      };
      found.seat.zones.battlefield.push(copy);
      pushLog(next, `Token copy of ${found.card.name}`);
      break;
    }
    case "exileTop": {
      const seat = seatOf(next, action.seatId);
      if (!seat) break;
      const taken = seat.zones.library.splice(0, action.n);
      seat.zones.exile.push(...taken);
      pushLog(next, `${seat.name} exiled top ${taken.length}`);
      break;
    }
    case "log":
      pushLog(next, action.text);
      break;
    case "cast":
    case "activate": {
      const found = findCard(next, action.instanceId);
      if (!found) break;
      const controller = found.card.controllerSeat || found.seat.id;
      const item = {
        id: uid("stk"),
        kind: action.type === "cast" ? "spell" as const : "ability" as const,
        name: action.type === "activate" && action.name ? action.name : found.card.name,
        controllerSeat: controller,
        instanceId: found.card.instanceId,
        targets: action.targets ?? [],
        x: action.x,
      };
      if (action.type === "cast") {
        const [card] = found.seat.zones[found.zone].splice(found.index, 1);
        card.controllerSeat = controller;
        const dest = seatOf(next, controller) ?? found.seat;
        dest.zones.stack.push(card);
      }
      next.stackItems = [...(next.stackItems ?? []), item];
      next.passed = [];
      pushLog(next, `${item.kind === "spell" ? "Cast" : "Activated"} ${item.name}${item.targets.length ? ` → ${item.targets.join(", ")}` : ""}`);
      break;
    }
    case "pass": {
      const seat = seatOf(next, action.seatId);
      if (!seat) break;
      const passed = new Set(next.passed ?? []);
      passed.add(seat.id);
      next.passed = [...passed];
      pushLog(next, `${seat.name} passed`);
      break;
    }
    case "counterSpell": {
      const items = next.stackItems ?? [];
      const idx = action.itemId ? items.findIndex((i) => i.id === action.itemId) : items.length - 1;
      if (idx < 0) break;
      const [item] = items.splice(idx, 1);
      next.stackItems = items;
      next.passed = [];
      if (item.instanceId && item.kind !== "ability") {
        const found = findCard(next, item.instanceId);
        if (found) {
          const [card] = found.seat.zones[found.zone].splice(found.index, 1);
          card.controllerSeat = card.ownerSeat;
          const owner = seatOf(next, card.ownerSeat) ?? found.seat;
          owner.zones.graveyard.push(card);
        }
      }
      pushLog(next, `Countered ${item.name}`);
      break;
    }
    case "copySpell": {
      const items = next.stackItems ?? [];
      const item = action.itemId ? items.find((i) => i.id === action.itemId) : items[items.length - 1];
      if (!item) break;
      next.stackItems = [
        ...items,
        {
          id: uid("stk"),
          kind: "copy",
          name: item.name,
          controllerSeat: item.controllerSeat,
          instanceId: item.instanceId,
          targets: [...item.targets],
          x: item.x,
          copyOf: item.id,
        },
      ];
      next.passed = [];
      pushLog(next, `Copied ${item.name}`);
      break;
    }
    case "setPhase": {
      next.phase = action.phase;
      pushLog(next, `Phase · ${action.phase}`);
      break;
    }
    case "resolveTop": {
      const items = next.stackItems ?? [];
      const item = items.pop();
      next.stackItems = items;
      next.passed = [];
      if (!item) break;
      if (item.kind === "copy" && item.instanceId) {
        const found = findCard(next, item.instanceId);
        if (found) {
          const dest = seatOf(next, item.controllerSeat) ?? found.seat;
          dest.zones.battlefield.push({
            ...structuredClone(found.card),
            instanceId: uid("tok"),
            token: true,
            ownerSeat: item.controllerSeat,
            controllerSeat: item.controllerSeat,
            tapped: false,
            attachedTo: undefined,
            enteredTurn: next.turn,
          });
        }
        pushLog(next, `Resolved copy of ${item.name}`);
        break;
      }
      if (item.instanceId && item.kind === "spell") {
        const found = findCard(next, item.instanceId);
        if (found) {
          const [card] = found.seat.zones[found.zone].splice(found.index, 1);
          applyMove(next, card, found.seat, found.zone, action.to, item.controllerSeat, undefined, ownerZones(action.to));
        }
      }
      pushLog(next, `Resolved ${item.name} → ${action.to}`);
      break;
    }
    default:
      break;
  }
  return next;
}

export function cardImage(card: PlayCard): string | undefined {
  if (card.facedown) return undefined;
  if (card.face === 1 && card.imageBack) return card.imageBack;
  return card.image;
}
