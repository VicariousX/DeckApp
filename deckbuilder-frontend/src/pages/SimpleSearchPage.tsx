import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { renderManaSymbol } from "../utils/symbols";
import styles from "./LoginPage.module.css";

const COLORS = ["W", "U", "B", "R", "G", "C"] as const;
type Color = (typeof COLORS)[number];

const TYPE_OPTIONS = [
  "Artifact", "Battle", "Conspiracy", "Creature", "Dungeon", "Enchantment",
  "Instant", "Land", "Phenomenon", "Plane", "Planeswalker", "Scheme",
  "Sorcery", "Tribal", "Vanguard",
  "Advisor", "Aetherborn", "Alien", "Ally", "Angel", "Antelope", "Ape",
  "Archer", "Archon", "Army", "Artificer", "Assassin", "Assembly-Worker",
  "Atog", "Aurochs", "Avatar", "Azra", "Badger", "Barbarian", "Bard",
  "Basilisk", "Bat", "Bear", "Beast", "Beeble", "Beholder", "Berserker",
  "Bird", "Blinkmoth", "Boar", "Bringer", "Brushwagg", "Camarid", "Camel",
  "Caribou", "Carrier", "Cat", "Centaur", "Cephalid", "Chimera", "Citizen",
  "Cleric", "Cockatrice", "Construct", "Coward", "Crab", "Crocodile",
  "Cyclops", "Dauthi", "Demigod", "Demon", "Deserter", "Devil", "Dinosaur",
  "Djinn", "Dog", "Dragon", "Drake", "Dreadnought", "Drone", "Druid",
  "Dryad", "Dwarf", "Efreet", "Egg", "Elder", "Eldrazi", "Elemental",
  "Elephant", "Elf", "Elk", "Eye", "Faerie", "Ferret", "Fish", "Flagbearer",
  "Fox", "Fractal", "Frog", "Fungus", "Gargoyle", "Germ", "Giant", "Gith",
  "Gnoll", "Gnome", "Goat", "Goblin", "God", "Golem", "Gorgon", "Graveborn",
  "Gremlin", "Griffin", "Hag", "Halfling", "Hamster", "Harpy", "Hellion",
  "Hippo", "Hippogriff", "Homarid", "Homunculus", "Horror", "Horse", "Human",
  "Hydra", "Hyena", "Illusion", "Imp", "Incarnation", "Inkling", "Insect",
  "Jackal", "Jellyfish", "Juggernaut", "Kavu", "Kirin", "Kithkin", "Knight",
  "Kobold", "Kor", "Kraken", "Lamia", "Lammasu", "Leech", "Leviathan",
  "Lhurgoyf", "Licid", "Lizard", "Manticore", "Masticore", "Mercenary",
  "Merfolk", "Metathran", "Minion", "Minotaur", "Mole", "Monger", "Mongoose",
  "Monk", "Monkey", "Moonfolk", "Mouse", "Mutant", "Myr", "Mystic", "Naga",
  "Nautilus", "Nephilim", "Nightmare", "Nightstalker", "Ninja", "Noble",
  "Noggle", "Nomad", "Nymph", "Octopus", "Ogre", "Ooze", "Orb", "Orc",
  "Orgg", "Otter", "Ouphe", "Ox", "Oyster", "Pangolin", "Peasant", "Pegasus",
  "Pentavite", "Pest", "Phelddagrif", "Phoenix", "Phyrexian", "Pilot",
  "Pincher", "Pirate", "Plant", "Praetor", "Prism", "Processor", "Rabbit",
  "Raccoon", "Ranger", "Rat", "Rebel", "Reflection", "Rhino", "Rigger",
  "Rogue", "Sable", "Salamander", "Samurai", "Sand", "Saproling", "Satyr",
  "Scarecrow", "Scion", "Scorpion", "Scout", "Serf", "Serpent", "Servo",
  "Shade", "Shaman", "Shapeshifter", "Shark", "Sheep", "Siren", "Skeleton",
  "Slith", "Sliver", "Slug", "Snake", "Soldier", "Soltari", "Spawn",
  "Specter", "Spellshaper", "Sphinx", "Spider", "Spike", "Spirit", "Splinter",
  "Sponge", "Squid", "Squirrel", "Starfish", "Surrakar", "Survivor", "Tentacle",
  "Tetravite", "Thalakos", "Thopter", "Thrull", "Tiefling", "Treefolk",
  "Trilobite", "Triskelavite", "Troll", "Turtle", "Unicorn", "Vampire",
  "Vedalken", "Viashino", "Volver", "Wall", "Warlock", "Warrior", "Weird",
  "Werewolf", "Whale", "Wizard", "Wolf", "Wolverine", "Wombat", "Worm",
  "Wraith", "Wurm", "Yeti", "Zombie", "Zubera",
  "Aura", "Cartouche", "Class", "Curse", "Rune", "Saga", "Shard", "Shrine",
  "Background", "Case", "Lesson", "Role", "Vehicle", "Equipment", "Fortification",
  "Clue", "Food", "Gold", "Treasure", "Blood", "Powerstone", "Map",
  "Plains", "Island", "Swamp", "Mountain", "Forest", "Desert", "Gate",
  "Lair", "Locus", "Mine", "Power-Plant", "Tower", "Urza's",
];

type Logic = "and" | "or";
type Cmp = "=" | "<=";

function colorClause(prefix: "id" | "c", selected: Color[], logic: Logic, cmp: Cmp): string {
  if (!selected.length) return "";
  if (logic === "and" && cmp === "=") {
    return `${prefix}=${selected.join("")}`;
  }
  if (logic === "and" && cmp === "<=") {
    return `${prefix}<=${selected.join("")}`;
  }
  // OR: each color as its own clause
  const parts = selected.map((c) => `${prefix}${cmp}${c}`);
  return parts.length > 1 ? `(${parts.join(" OR ")})` : parts[0];
}

function typeClause(types: string[], logic: Logic): string {
  if (!types.length) return "";
  const parts = types.map((t) => `t:${t.toLowerCase()}`);
  return parts.length > 1 ? `(${parts.join(logic === "or" ? " OR " : " ")})` : parts[0];
}

export function SimpleSearchPage() {
  const navigate = useNavigate();
  const [idColors, setIdColors] = useState<Color[]>([]);
  const [idLogic, setIdLogic] = useState<Logic>("or");
  const [idCmp, setIdCmp] = useState<Cmp>("<=");
  const [cardColors, setCardColors] = useState<Color[]>([]);
  const [cardLogic, setCardLogic] = useState<Logic>("or");
  const [cardCmp, setCardCmp] = useState<Cmp>("<=");
  const [typeQuery, setTypeQuery] = useState("");
  const [types, setTypes] = useState<string[]>([]);
  const [typeLogic, setTypeLogic] = useState<Logic>("or");
  const [isCommander, setIsCommander] = useState(false);
  const [oracle, setOracle] = useState("");
  const [mechanic, setMechanic] = useState("");

  const typeMatches = useMemo(() => {
    const q = typeQuery.trim().toLowerCase();
    if (!q) return [];
    return TYPE_OPTIONS.filter((t) => t.toLowerCase().includes(q) && !types.includes(t)).slice(0, 8);
  }, [typeQuery, types]);

  function toggleColor(list: Color[], set: (next: Color[]) => void, c: Color) {
    set(list.includes(c) ? list.filter((x) => x !== c) : [...list, c]);
  }

  function addType(name: string) {
    if (!types.includes(name)) setTypes([...types, name]);
    setTypeQuery("");
  }

  function removeType(name: string) {
    setTypes(types.filter((t) => t !== name));
  }

  function buildQuery(): string {
    const parts: string[] = [];
    const id = colorClause("id", idColors, idLogic, idCmp);
    if (id) parts.push(id);
    const cc = colorClause("c", cardColors, cardLogic, cardCmp);
    if (cc) parts.push(cc);
    const tc = typeClause(types, typeLogic);
    if (tc) parts.push(tc);
    if (isCommander) parts.push("is:commander");
    const o = oracle.trim();
    if (o) parts.push(o.includes(" ") ? `o:"${o}"` : `o:${o}`);
    if (mechanic.trim()) parts.push(`mech:${mechanic.trim()}`);
    return parts.join(" ");
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const q = buildQuery();
    if (!q) return;
    navigate(`/search/results?q=${encodeURIComponent(q)}&mode=standard`);
  }

  return (
    <div className={styles.accountContent} style={{ maxWidth: 720, margin: "1.5rem auto", padding: "0 1rem" }}>
      <h1 className={styles.title}>Simple search</h1>
      <p className={styles.subtitle}>Build a query with colors, types, and text. Submit to see results.</p>

      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: "1.25rem", marginTop: 16 }}>
        <ColorRow
          label="Color identity"
          selected={idColors}
          logic={idLogic}
          cmp={idCmp}
          onToggle={(c) => toggleColor(idColors, setIdColors, c)}
          onLogic={setIdLogic}
          onCmp={setIdCmp}
        />
        <ColorRow
          label="Card color"
          selected={cardColors}
          logic={cardLogic}
          cmp={cardCmp}
          onToggle={(c) => toggleColor(cardColors, setCardColors, c)}
          onLogic={setCardLogic}
          onCmp={setCardCmp}
        />

        <section>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
            <span className={styles.label}>Type</span>
            <LogicToggle value={typeLogic} onChange={setTypeLogic} />
          </div>
          <div style={{ position: "relative" }}>
            <input
              className={styles.input}
              value={typeQuery}
              onChange={(e) => setTypeQuery(e.target.value)}
              placeholder="Add a type…"
              autoComplete="off"
            />
            {typeMatches.length > 0 && (
              <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 10, marginTop: 4, border: "1px solid #333", borderRadius: 6, overflow: "hidden", background: "var(--color-surface)" }}>
                {typeMatches.map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={styles.secondaryBtn}
                    style={{ display: "block", width: "100%", textAlign: "left", borderRadius: 0, border: "none", borderBottom: "1px solid #333" }}
                    onClick={() => addType(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}
          </div>
          {types.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
              {types.map((t) => (
                <span key={t} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 999, border: "1px solid #444", fontSize: "0.85rem" }}>
                  {t}
                  <button type="button" onClick={() => removeType(t)} aria-label={`Remove ${t}`} style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", padding: 0 }}>
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </section>

        <section>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
            <input type="checkbox" checked={isCommander} onChange={(e) => setIsCommander(e.target.checked)} />
            <span className={styles.label}>Is commander</span>
          </label>
        </section>

        <section>
          <label className={styles.label}>Oracle text</label>
          <input
            className={styles.input}
            value={oracle}
            onChange={(e) => setOracle(e.target.value)}
            placeholder="Text on the card…"
          />
        </section>

        <section>
          <label className={styles.label}>Mechanic</label>
          <input
            className={styles.input}
            value={mechanic}
            onChange={(e) => setMechanic(e.target.value)}
            placeholder="Mechanic selector (coming soon)"
            disabled
          />
          <p className={styles.subtitle} style={{ marginTop: 4, fontSize: "0.75rem" }}>
            Mechanic tracking is still in development.
          </p>
        </section>

        <button type="submit" className={styles.primaryBtn}>
          Search
        </button>
      </form>
    </div>
  );
}

function ColorRow({
  label,
  selected,
  logic,
  cmp,
  onToggle,
  onLogic,
  onCmp,
}: {
  label: string;
  selected: Color[];
  logic: Logic;
  cmp: Cmp;
  onToggle: (c: Color) => void;
  onLogic: (v: Logic) => void;
  onCmp: (v: Cmp) => void;
}) {
  return (
    <section>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6, flexWrap: "wrap" }}>
        <span className={styles.label}>{label}</span>
        <LogicToggle value={logic} onChange={onLogic} />
        <CmpToggle value={cmp} onChange={onCmp} />
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        {COLORS.map((c) => {
          const on = selected.includes(c);
          return (
            <button
              key={c}
              type="button"
              onClick={() => onToggle(c)}
              aria-pressed={on}
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                border: on ? "2px solid var(--color-accent)" : "1px solid #444",
                background: on ? "color-mix(in srgb, var(--color-accent) 20%, transparent)" : "transparent",
                display: "grid",
                placeItems: "center",
                cursor: "pointer",
                padding: 0,
              }}
            >
              {renderManaSymbol(`{${c}}`, 22)}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function LogicToggle({ value, onChange }: { value: Logic; onChange: (v: Logic) => void }) {
  return (
    <span style={{ display: "inline-flex", borderRadius: 6, overflow: "hidden", border: "1px solid #444" }}>
      {(["or", "and"] as const).map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          style={{
            padding: "2px 8px",
            border: "none",
            background: value === v ? "var(--color-accent)" : "transparent",
            color: value === v ? "#000" : "inherit",
            fontSize: "0.75rem",
            fontWeight: 650,
            cursor: "pointer",
            textTransform: "uppercase",
          }}
        >
          {v}
        </button>
      ))}
    </span>
  );
}

function CmpToggle({ value, onChange }: { value: Cmp; onChange: (v: Cmp) => void }) {
  return (
    <span style={{ display: "inline-flex", borderRadius: 6, overflow: "hidden", border: "1px solid #444" }}>
      {(["<=", "="] as const).map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          style={{
            padding: "2px 8px",
            border: "none",
            background: value === v ? "var(--color-accent)" : "transparent",
            color: value === v ? "#000" : "inherit",
            fontSize: "0.75rem",
            fontWeight: 650,
            cursor: "pointer",
          }}
        >
          {v}
        </button>
      ))}
    </span>
  );
}
