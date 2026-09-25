export type MechanicFamily =
  | "tokens"
  | "counters"
  | "sacrifice"
  | "graveyard"
  | "battlefield"
  | "cardflow"
  | "mana"
  | "combat"
  | "damage"
  | "life"
  | "permanents"
  | "spells"
  | "control"
  | "keywords"
  | "tribes"
  | "casual";

export type MechanicDef = {
  id: string;
  name: string;
  family: MechanicFamily;
  hint: string;
};

export const MECHANIC_FAMILIES: { id: MechanicFamily; label: string }[] = [
  { id: "tokens", label: "Tokens" },
  { id: "counters", label: "Counters" },
  { id: "sacrifice", label: "Sacrifice & death" },
  { id: "graveyard", label: "Graveyard" },
  { id: "battlefield", label: "Enters / leaves" },
  { id: "cardflow", label: "Card flow" },
  { id: "mana", label: "Mana & lands" },
  { id: "combat", label: "Combat" },
  { id: "damage", label: "Damage" },
  { id: "life", label: "Life" },
  { id: "permanents", label: "Permanents" },
  { id: "spells", label: "Spells" },
  { id: "control", label: "Control & hate" },
  { id: "keywords", label: "Keywords" },
  { id: "tribes", label: "Tribes" },
  { id: "casual", label: "Commander extras" },
];

export const MECHANICS: MechanicDef[] = [
  { id: "tokens", name: "Tokens", family: "tokens", hint: "Create or care about tokens" },
  { id: "treasure", name: "Treasure", family: "tokens", hint: "Treasure tokens" },
  { id: "clues", name: "Clues / investigate", family: "tokens", hint: "Investigate and clue tokens" },
  { id: "food", name: "Food", family: "tokens", hint: "Food tokens" },
  { id: "blood", name: "Blood", family: "tokens", hint: "Blood tokens" },
  { id: "maps", name: "Maps", family: "tokens", hint: "Map tokens" },
  { id: "roles", name: "Roles", family: "tokens", hint: "Role tokens" },
  { id: "junk", name: "Junk", family: "tokens", hint: "Junk tokens" },
  { id: "powerstone", name: "Powerstone", family: "tokens", hint: "Powerstone tokens" },
  { id: "plus1", name: "+1/+1 counters", family: "counters", hint: "Place or care about +1/+1" },
  { id: "minus1", name: "-1/-1 counters", family: "counters", hint: "Wither, infect style" },
  { id: "charge", name: "Charge counters", family: "counters", hint: "Charge counters on permanents" },
  { id: "proliferate", name: "Proliferate", family: "counters", hint: "Add counters already there" },
  { id: "energy", name: "Energy", family: "counters", hint: "{E} energy" },
  { id: "experience", name: "Experience", family: "counters", hint: "Experience counters" },
  { id: "poison", name: "Poison", family: "counters", hint: "Poison counters" },
  { id: "oil", name: "Oil counters", family: "counters", hint: "Oil counters" },
  { id: "stun", name: "Stun counters", family: "counters", hint: "Stun counters" },
  { id: "shield", name: "Shield counters", family: "counters", hint: "Shield counters" },
  { id: "lore", name: "Lore / sagas", family: "counters", hint: "Saga lore counters" },
  { id: "time-counters", name: "Time counters", family: "counters", hint: "Suspend / vanishing" },
  { id: "sacrifice", name: "Sacrifice", family: "sacrifice", hint: "Sacrifice costs or outlets" },
  { id: "aristocrats", name: "Aristocrats", family: "sacrifice", hint: "Death triggers and outlets" },
  { id: "dies", name: "Dies triggers", family: "sacrifice", hint: "When a permanent dies" },
  { id: "etb", name: "ETB", family: "battlefield", hint: "Enters the battlefield" },
  { id: "ltb", name: "Leaves battlefield", family: "battlefield", hint: "Leaves play" },
  { id: "flicker", name: "Flicker", family: "battlefield", hint: "Exile and return" },
  { id: "bounce", name: "Bounce", family: "battlefield", hint: "Return to hand" },
  { id: "exile", name: "Exile", family: "battlefield", hint: "Exile zone matter" },
  { id: "gy-fill", name: "Fill graveyard", family: "graveyard", hint: "Mill, discard, dredge" },
  { id: "gy-recur", name: "Recursion", family: "graveyard", hint: "Return from graveyard" },
  { id: "reanimate", name: "Reanimate", family: "graveyard", hint: "Creatures from graveyard" },
  { id: "flashback", name: "Flashback / escape", family: "graveyard", hint: "Cast from graveyard" },
  { id: "draw", name: "Draw", family: "cardflow", hint: "Draw cards" },
  { id: "impulse", name: "Impulse / exile-draw", family: "cardflow", hint: "Exile then play" },
  { id: "discard", name: "Discard", family: "cardflow", hint: "Discard as cost or effect" },
  { id: "tutor", name: "Tutor", family: "cardflow", hint: "Search library" },
  { id: "wheels", name: "Wheels", family: "cardflow", hint: "Mass draw/discard" },
  { id: "ramp", name: "Ramp", family: "mana", hint: "Accelerates mana" },
  { id: "ritual", name: "Ritual", family: "mana", hint: "Burst mana" },
  { id: "rocks", name: "Mana rocks", family: "mana", hint: "Artifact mana" },
  { id: "dorks", name: "Mana dorks", family: "mana", hint: "Creature mana" },
  { id: "landfall", name: "Landfall", family: "mana", hint: "Land entering" },
  { id: "lands-matter", name: "Lands matter", family: "mana", hint: "Extra lands, land types" },
  { id: "fetch", name: "Fetch / crack lands", family: "mana", hint: "Sacrifice lands to find" },
  { id: "cost-reduce", name: "Cost reduction", family: "mana", hint: "Spells or permanents cost less" },
  { id: "combat-trigger", name: "Attack / combat triggers", family: "combat", hint: "On attack or deal combat damage" },
  { id: "extra-combat", name: "Extra combats", family: "combat", hint: "Additional combat steps" },
  { id: "evasion", name: "Evasion", family: "combat", hint: "Flying, unblockable, etc." },
  { id: "goad", name: "Goad / force attack", family: "combat", hint: "Must attack" },
  { id: "connect", name: "Connect", family: "combat", hint: "Damage to players" },
  { id: "direct-damage", name: "Direct damage", family: "damage", hint: "Noncombat damage" },
  { id: "ping", name: "Pingers", family: "damage", hint: "Repeatable 1 damage" },
  { id: "lifegain", name: "Lifegain", family: "life", hint: "Gain life" },
  { id: "lifeloss", name: "Lifeloss", family: "life", hint: "Opponents lose life" },
  { id: "lifelink-matter", name: "Life totals matter", family: "life", hint: "Pay life or care about totals" },
  { id: "artifacts-matter", name: "Artifacts matter", family: "permanents", hint: "Artifact synergy" },
  { id: "enchantress", name: "Enchantments matter", family: "permanents", hint: "Enchantress" },
  { id: "historic", name: "Historic", family: "permanents", hint: "Legendary, artifact, saga" },
  { id: "equipment", name: "Equipment / voltron", family: "permanents", hint: "Equip and auras" },
  { id: "aura", name: "Auras", family: "permanents", hint: "Enchant creature etc." },
  { id: "vehicles", name: "Vehicles", family: "permanents", hint: "Crew and vehicles" },
  { id: "pw", name: "Planeswalkers", family: "permanents", hint: "Superfriends" },
  { id: "sagas", name: "Sagas", family: "permanents", hint: "Saga permanents" },
  { id: "spellslinger", name: "Instants & sorceries", family: "spells", hint: "Nonpermanent spells" },
  { id: "prowess", name: "Prowess-like", family: "spells", hint: "Cast trigger on spells" },
  { id: "storm", name: "Storm / copy spells", family: "spells", hint: "Copy or storm" },
  { id: "cascade", name: "Cascade / discover", family: "spells", hint: "Cast from library" },
  { id: "extra-turn", name: "Extra turns", family: "spells", hint: "Take another turn" },
  { id: "stax", name: "Stax", family: "control", hint: "Tax, lock, deny" },
  { id: "counterspell", name: "Counterspells", family: "control", hint: "Counter spells" },
  { id: "removal", name: "Spot removal", family: "control", hint: "Destroy or exile one" },
  { id: "wipe", name: "Board wipes", family: "control", hint: "Mass removal" },
  { id: "theft", name: "Theft", family: "control", hint: "Gain control" },
  { id: "hate", name: "Hate pieces", family: "control", hint: "Shuts a strategy down" },
  { id: "tap-untap", name: "Tap / untap", family: "keywords", hint: "Untap engines" },
  { id: "populate", name: "Populate", family: "keywords", hint: "Copy a token" },
  { id: "convoke", name: "Convoke / improvise", family: "keywords", hint: "Tap to pay" },
  { id: "morph", name: "Morph / disguise", family: "keywords", hint: "Face-down creatures" },
  { id: "transform", name: "Transform / MDFC", family: "keywords", hint: "Double-faced" },
  { id: "adventure", name: "Adventure", family: "keywords", hint: "Adventure cards" },
  { id: "humans", name: "Humans", family: "tribes", hint: "Human tribal" },
  { id: "elves", name: "Elves", family: "tribes", hint: "Elf tribal" },
  { id: "goblins", name: "Goblins", family: "tribes", hint: "Goblin tribal" },
  { id: "zombies", name: "Zombies", family: "tribes", hint: "Zombie tribal" },
  { id: "vampires", name: "Vampires", family: "tribes", hint: "Vampire tribal" },
  { id: "soldiers", name: "Soldiers", family: "tribes", hint: "Soldier tribal" },
  { id: "wizards", name: "Wizards", family: "tribes", hint: "Wizard tribal" },
  { id: "dragons", name: "Dragons", family: "tribes", hint: "Dragon tribal" },
  { id: "angels", name: "Angels", family: "tribes", hint: "Angel tribal" },
  { id: "demons", name: "Demons", family: "tribes", hint: "Demon tribal" },
  { id: "spirits", name: "Spirits", family: "tribes", hint: "Spirit tribal" },
  { id: "merfolk", name: "Merfolk", family: "tribes", hint: "Merfolk tribal" },
  { id: "pirates", name: "Pirates", family: "tribes", hint: "Pirate tribal" },
  { id: "dinosaurs", name: "Dinosaurs", family: "tribes", hint: "Dinosaur tribal" },
  { id: "cats", name: "Cats", family: "tribes", hint: "Cat tribal" },
  { id: "knights", name: "Knights", family: "tribes", hint: "Knight tribal" },
  { id: "warriors", name: "Warriors", family: "tribes", hint: "Warrior tribal" },
  { id: "clerics", name: "Clerics", family: "tribes", hint: "Cleric tribal" },
  { id: "rogues", name: "Rogues", family: "tribes", hint: "Rogue tribal" },
  { id: "shamans", name: "Shamans", family: "tribes", hint: "Shaman tribal" },
  { id: "druids", name: "Druids", family: "tribes", hint: "Druid tribal" },
  { id: "allies", name: "Allies", family: "tribes", hint: "Ally tribal" },
  { id: "slivers", name: "Slivers", family: "tribes", hint: "Sliver tribal" },
  { id: "eldrazi", name: "Eldrazi", family: "tribes", hint: "Eldrazi tribal" },
  { id: "phyrexian", name: "Phyrexians", family: "tribes", hint: "Phyrexian tribal" },
  { id: "tribal", name: "Tribal (generic)", family: "tribes", hint: "Any creature type matters" },
  { id: "monarch", name: "The monarch", family: "casual", hint: "Monarch extra" },
  { id: "initiative", name: "Initiative", family: "casual", hint: "Dungeon / initiative" },
  { id: "ring", name: "The Ring", family: "casual", hint: "Tempted by the Ring" },
  { id: "venture", name: "Venture / dungeons", family: "casual", hint: "Dungeons" },
  { id: "daynight", name: "Day / night", family: "casual", hint: "Daybound nightbound" },
  { id: "politics", name: "Politics", family: "casual", hint: "Goad, votes, gifts" },
  { id: "group-hug", name: "Group hug", family: "casual", hint: "Helps all players" },
];

export function mechanicById(id: string): MechanicDef | undefined {
  return MECHANICS.find((m) => m.id === id);
}

export const ECONOMY = ["producer", "payoff", "both"] as const;
export const FLOW = ["feed", "bleed", "both"] as const;
export const AGENCY = ["cause", "benefit", "both"] as const;

export type Economy = (typeof ECONOMY)[number];
export type Flow = (typeof FLOW)[number];
export type Agency = (typeof AGENCY)[number];

export const ECONOMY_LABEL: Record<Economy, string> = {
  producer: "Producer",
  payoff: "Payoff",
  both: "Both",
};
export const FLOW_LABEL: Record<Flow, string> = {
  feed: "Feed",
  bleed: "Bleed",
  both: "Both",
};
export const AGENCY_LABEL: Record<Agency, string> = {
  cause: "Cause",
  benefit: "Benefit",
  both: "Both",
};
