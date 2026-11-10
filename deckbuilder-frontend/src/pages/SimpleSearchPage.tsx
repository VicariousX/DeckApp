import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { renderManaSymbol } from "../utils/symbols";
import { buildSimpleQuery, decodeSimpleState, encodeSimpleState, type Color, type IdLogic, type Logic, type SimpleState, type StatChip, type StatField, type StatOp } from "../lib/search/simpleQuery";
import styles from "./LoginPage.module.css";

const COLORS = ["W", "U", "B", "R", "G", "C"] as const;

const SUPERTYPES = ["Basic", "Legendary", "Ongoing", "Snow", "World", "Elite", "Host", "Token"];
const CARD_TYPES = [
  "Artifact", "Battle", "Conspiracy", "Creature", "Dungeon", "Enchantment",
  "Instant", "Kindred", "Land", "Phenomenon", "Plane", "Planeswalker",
  "Scheme", "Sorcery", "Tribal", "Vanguard",
];
const SUBTYPES = [
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
  "Arcane", "Trap",
];
const TYPE_OPTIONS = [...SUPERTYPES, ...CARD_TYPES, ...SUBTYPES];

export function SimpleSearchPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const restored = useMemo(() => {
    const raw = params.get("ss");
    return raw ? decodeSimpleState(raw) : null;
  }, [params]);

  const [name, setName] = useState(restored?.name ?? "");
  const [idColors, setIdColors] = useState<Color[]>(restored?.idColors ?? []);
  const [idLogic, setIdLogic] = useState<IdLogic>(restored?.idLogic ?? "or");
  const [cardColors, setCardColors] = useState<Color[]>(restored?.cardColors ?? []);
  const [cardLogic, setCardLogic] = useState<Logic>(restored?.cardLogic ?? "or");
  const [typeQuery, setTypeQuery] = useState("");
  const [types, setTypes] = useState<string[]>(restored?.types ?? []);
  const [typeLogic, setTypeLogic] = useState<Logic>(restored?.typeLogic ?? "or");
  const [isCommander, setIsCommander] = useState(restored?.isCommander ?? false);
  const [oracleInput, setOracleInput] = useState("");
  const [oracle, setOracle] = useState<string[]>(restored?.oracle ?? []);
  const [oracleLogic, setOracleLogic] = useState<Logic>(restored?.oracleLogic ?? "or");
  const [statField, setStatField] = useState<StatField>("mv");
  const [statOp, setStatOp] = useState<StatOp>("=");
  const [statValue, setStatValue] = useState("");
  const [stats, setStats] = useState<StatChip[]>(restored?.stats ?? []);
  const [mechanic, setMechanic] = useState(restored?.mechanic ?? "");

  useEffect(() => {
    if (!restored) return;
    setName(restored.name);
    setIdColors(restored.idColors);
    setIdLogic(restored.idLogic);
    setCardColors(restored.cardColors);
    setCardLogic(restored.cardLogic);
    setTypes(restored.types);
    setTypeLogic(restored.typeLogic);
    setIsCommander(restored.isCommander);
    setOracle(restored.oracle);
    setOracleLogic(restored.oracleLogic);
    setStats(restored.stats ?? []);
    setMechanic(restored.mechanic ?? "");
  }, [restored]);

  const typeMatches = useMemo(() => {
    const q = typeQuery.trim().toLowerCase();
    if (!q) return [];
    return TYPE_OPTIONS.filter((t) => t.toLowerCase().includes(q) && !types.includes(t)).slice(0, 10);
  }, [typeQuery, types]);

  function toggleColor(list: Color[], set: (next: Color[]) => void, c: Color) {
    set(list.includes(c) ? list.filter((x) => x !== c) : [...list, c]);
  }

  function addType(n: string) {
    if (!types.includes(n)) setTypes([...types, n]);
    setTypeQuery("");
  }

  function addOracle() {
    const t = oracleInput.trim();
    if (!t || oracle.includes(t)) return;
    setOracle([...oracle, t]);
    setOracleInput("");
  }

  function buildQuery(): string {
    return buildSimpleQuery({
      name, idColors, idLogic, cardColors, cardLogic, types, typeLogic,
      isCommander, oracle, oracleLogic, stats, mechanic,
    });
  }

  function addStat() {
    const n = Number(statValue);
    if (!Number.isFinite(n)) return;
    setStats([...stats, { field: statField, op: statOp, value: n }]);
    setStatValue("");
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const q = buildQuery();
    if (!q) return;
    const state: SimpleState = { name, idColors, idLogic, cardColors, cardLogic, types, typeLogic, isCommander, oracle, oracleLogic, stats, mechanic };
    navigate(`/search/results?q=${encodeURIComponent(q)}&mode=simple&ss=${encodeSimpleState(state)}`);
  }

  return (
    <div className={styles.accountContent} style={{ maxWidth: 720, margin: "1.5rem auto", padding: "0 1rem" }}>
      <style>{`
        .no-spin::-webkit-outer-spin-button,
        .no-spin::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        .no-spin { -moz-appearance: textfield; }
      `}</style>
      <h1 className={styles.title}>Simple search</h1>
      <p className={styles.subtitle}>Build a query. Submit to see results.</p>

      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: "1.25rem", marginTop: 16 }}>
        <section>
          <label className={styles.label}>Name</label>
          <input
            className={styles.input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Card name…"
          />
        </section>

        <ColorRow
          label="Color identity"
          selected={idColors}
          logic={idLogic}
          onToggle={(c) => toggleColor(idColors, setIdColors, c)}
          onLogic={setIdLogic}
          options={["or", "and", "commander"]}
        />
        <ColorRow
          label="Card color"
          selected={cardColors}
          logic={cardLogic}
          onToggle={(c) => toggleColor(cardColors, setCardColors, c)}
          onLogic={setCardLogic}
          options={["or", "and"]}
        />

        <section>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
            <span className={styles.label}>Type</span>
            <LogicToggle value={typeLogic} onChange={setTypeLogic} options={["or", "and"]} />
            <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
              <span className={styles.label}>Is commander</span>
              <PillToggle on={isCommander} onChange={setIsCommander} />
            </span>
          </div>
          <div style={{ position: "relative" }}>
            <input
              className={styles.input}
              value={typeQuery}
              onChange={(e) => setTypeQuery(e.target.value)}
              placeholder="Add a type, supertype, or subtype…"
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
          <ChipRow items={types} onRemove={(t) => setTypes(types.filter((x) => x !== t))} />
        </section>

        <section>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
            <span className={styles.label}>Oracle text</span>
            <LogicToggle value={oracleLogic} onChange={setOracleLogic} options={["or", "and"]} />
          </div>
          <div style={{ display: "flex", alignItems: "stretch" }}>
            <textarea
              className={styles.input}
              value={oracleInput}
              onChange={(e) => {
                setOracleInput(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = `${e.target.scrollHeight}px`;
              }}
              placeholder="Add a text phrase…"
              rows={1}
              style={{
                resize: "none",
                overflow: "hidden",
                minHeight: 36,
                borderTopRightRadius: 0,
                borderBottomRightRadius: 0,
                flex: 1,
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  addOracle();
                }
              }}
            />
            <button
              type="button"
              onClick={addOracle}
              aria-label="Add oracle phrase"
              style={{
                width: 36,
                border: "1px solid #444",
                borderLeft: "none",
                borderRadius: "0 8px 8px 0",
                background: "var(--color-surface)",
                color: "inherit",
                fontSize: "1.1rem",
                fontWeight: 650,
                cursor: "pointer",
                display: "grid",
                placeItems: "center",
                lineHeight: 1,
              }}
            >
              +
            </button>
          </div>
          <ChipRow items={oracle} onRemove={(t) => setOracle(oracle.filter((x) => x !== t))} />
        </section>

        <section>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
            <span className={styles.label}>Value</span>
            <CycleBtn
              value={statField}
              options={["mv", "edhrec"] as const}
              labels={{ mv: "MV", edhrec: "EDHREC" }}
              onChange={setStatField}
            />
            <CycleBtn
              value={statOp}
              options={["=", "<=", ">=", "<", ">", "!="] as const}
              onChange={setStatOp}
            />
            <div style={{ display: "flex", alignItems: "stretch" }}>
              <div style={{ display: "flex", alignItems: "center", border: "1px solid #444", borderRadius: "8px 0 0 8px", background: "var(--color-surface)", height: 36 }}>
                <button
                  type="button"
                  onClick={() => setStatValue(String(Math.max(0, Number(statValue || 0) - 1)))}
                  aria-label="Decrease"
                  style={{ width: 28, height: "100%", border: "none", background: "transparent", color: "inherit", cursor: "pointer", fontSize: "1rem" }}
                >
                  −
                </button>
                <input
                  type="number"
                  value={statValue}
                  onChange={(e) => setStatValue(e.target.value)}
                  placeholder="0"
                  style={{
                    width: 56,
                    border: "none",
                    background: "transparent",
                    color: "inherit",
                    textAlign: "center",
                    font: "inherit",
                    outline: "none",
                    MozAppearance: "textfield",
                  }}
                  className="no-spin"
                />
                <button
                  type="button"
                  onClick={() => setStatValue(String(Number(statValue || 0) + 1))}
                  aria-label="Increase"
                  style={{ width: 28, height: "100%", border: "none", background: "transparent", color: "inherit", cursor: "pointer", fontSize: "1rem" }}
                >
                  +
                </button>
              </div>
              <button
                type="button"
                onClick={addStat}
                aria-label="Add value"
                style={{
                  width: 36,
                  height: 36,
                  border: "1px solid #444",
                  borderLeft: "none",
                  borderRadius: "0 8px 8px 0",
                  background: "var(--color-surface)",
                  color: "inherit",
                  fontSize: "1.1rem",
                  fontWeight: 650,
                  cursor: "pointer",
                  display: "grid",
                  placeItems: "center",
                }}
              >
                +
              </button>
            </div>
          </div>
          <ChipRow
            items={stats.map((s) => `${s.field === "mv" ? "MV" : "EDHREC"} ${s.op} ${s.value}`)}
            onRemove={(label) => {
              const idx = stats.findIndex((s) => `${s.field === "mv" ? "MV" : "EDHREC"} ${s.op} ${s.value}` === label);
              if (idx >= 0) setStats(stats.filter((_, i) => i !== idx));
            }}
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

function ColorRow<L extends string>({
  label,
  selected,
  logic,
  onToggle,
  onLogic,
  options,
}: {
  label: string;
  selected: Color[];
  logic: L;
  onToggle: (c: Color) => void;
  onLogic: (v: L) => void;
  options: readonly L[];
}) {
  return (
    <section>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6, flexWrap: "wrap" }}>
        <span className={styles.label}>{label}</span>
        <LogicToggle value={logic} onChange={onLogic} options={options} />
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

function LogicToggle<L extends string>({ value, onChange, options }: { value: L; onChange: (v: L) => void; options: readonly L[] }) {
  return (
    <span style={{ display: "inline-flex", borderRadius: 6, overflow: "hidden", border: "1px solid #444" }}>
      {options.map((v) => (
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
          {v === "commander" ? "Commander's" : v}
        </button>
      ))}
    </span>
  );
}

function CycleBtn<T extends string>({
  value,
  options,
  labels,
  onChange,
}: {
  value: T;
  options: readonly T[];
  labels?: Record<string, string>;
  onChange: (v: T) => void;
}) {
  function cycle() {
    const i = options.indexOf(value);
    onChange(options[(i + 1) % options.length]);
  }
  return (
    <button
      type="button"
      onClick={cycle}
      style={{
        height: 36,
        padding: "0 12px",
        borderRadius: 8,
        border: "1px solid #444",
        background: "transparent",
        color: "inherit",
        fontSize: "0.8rem",
        fontWeight: 650,
        cursor: "pointer",
        minWidth: 52,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {labels?.[value] ?? value}
    </button>
  );
}

function PillToggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      aria-pressed={on}
      style={{
        width: 44,
        height: 24,
        borderRadius: 12,
        border: "none",
        background: on ? "var(--color-accent)" : "#444",
        position: "relative",
        cursor: "pointer",
        padding: 0,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 2,
          left: on ? 22 : 2,
          width: 20,
          height: 20,
          borderRadius: "50%",
          background: "#fff",
          transition: "left 120ms ease",
        }}
      />
    </button>
  );
}

function ChipRow({ items, onRemove }: { items: string[]; onRemove: (item: string) => void }) {
  if (!items.length) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
      {items.map((t) => (
        <span key={t} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 999, border: "1px solid #444", fontSize: "0.85rem" }}>
          {t}
          <button type="button" onClick={() => onRemove(t)} aria-label={`Remove ${t}`} style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", padding: 0 }}>
            ×
          </button>
        </span>
      ))}
    </div>
  );
}
