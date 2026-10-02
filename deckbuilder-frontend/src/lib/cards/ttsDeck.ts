/** Tabletop Simulator saved-object deck. Faces are Scryfall image URLs. */

export type TtsCard = {
  name: string;
  scryfallId: string;
  quantity?: number;
  faceUrl?: string;
};

export type TtsDeckPart = {
  name: string;
  cards: TtsCard[];
};

const BACK =
  "https://backs.scryfall.io/large/0/0/0aeebaf5-8c7d-4636-9e82-8c27447861f7.jpg";

function faceOf(card: TtsCard): string {
  if (card.faceUrl) return card.faceUrl;
  return `https://api.scryfall.com/cards/${card.scryfallId}?format=image&version=normal`;
}

function transform(x: number) {
  return {
    posX: x,
    posY: 1,
    posZ: 0,
    rotX: 0,
    rotY: 180,
    rotZ: 180,
    scaleX: 1,
    scaleY: 1,
    scaleZ: 1,
  };
}

function deckObject(part: TtsDeckPart, x: number) {
  const custom: Record<string, unknown> = {};
  const ids: number[] = [];
  const contained: unknown[] = [];
  let n = 1;
  for (const card of part.cards) {
    const qty = Math.max(1, card.quantity ?? 1);
    for (let i = 0; i < qty; i += 1) {
      const key = String(n);
      const cardId = n * 100;
      custom[key] = {
        FaceURL: faceOf(card),
        BackURL: BACK,
        NumWidth: 1,
        NumHeight: 1,
        BackIsHidden: true,
        UniqueBack: false,
      };
      ids.push(cardId);
      contained.push({
        Name: "Card",
        Nickname: card.name,
        Description: card.scryfallId,
        CardID: cardId,
        Transform: transform(0),
      });
      n += 1;
    }
  }
  return {
    Name: "DeckCustom",
    Nickname: part.name,
    Transform: transform(x),
    DeckIDs: ids,
    CustomDeck: custom,
    ContainedObjects: contained,
    ColorDiffuse: { r: 1, g: 1, b: 1 },
  };
}

export function buildTtsSavedObject(name: string, parts: TtsDeckPart[]): string {
  const objects = parts
    .filter((p) => p.cards.length)
    .map((p, i) => deckObject(p, i * 3));
  return JSON.stringify(
    {
      SaveName: name,
      GameMode: "",
      Date: "",
      Table: "",
      Sky: "",
      Note: "DeckApp export. Put this file in Documents/My Games/Tabletop Simulator/Saves/Saved Objects, then spawn it from Objects > Saved Objects.",
      Rules: "",
      PlayerTurn: "",
      ObjectStates: objects,
    },
    null,
    2
  );
}

export function namesFromTtsJson(raw: string): { name: string; quantity: number }[] {
  const data = JSON.parse(raw) as { ObjectStates?: unknown[] };
  const counts = new Map<string, number>();
  const walk = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    const obj = node as { Nickname?: string; ContainedObjects?: unknown[]; ObjectStates?: unknown[] };
    if (obj.Nickname && obj.Nickname.trim() && !obj.ContainedObjects?.length) {
      const name = obj.Nickname.trim();
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    for (const child of obj.ContainedObjects ?? []) walk(child);
    for (const child of obj.ObjectStates ?? []) walk(child);
  };
  for (const state of data.ObjectStates ?? []) walk(state);
  return [...counts.entries()].map(([name, quantity]) => ({ name, quantity }));
}
