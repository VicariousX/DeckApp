import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CardTile, CardTileField } from "../components/CardTile";
import { useSearchStream } from "../hooks/useSearchStream";
import { fetchAutocomplete } from "../lib/scryfallApi";
import type { ScryfallCard } from "../types/scryfallCard";
import styles from "./LoginPage.module.css";

const COLORS = [
  { id: "W", label: "White" },
  { id: "U", label: "Blue" },
  { id: "B", label: "Black" },
  { id: "R", label: "Red" },
  { id: "G", label: "Green" },
  { id: "C", label: "Colorless" },
];

const TYPES = ["Creature", "Instant", "Sorcery", "Enchantment", "Artifact", "Planeswalker", "Land"];

export function SimpleSearchPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [colors, setColors] = useState<string[]>([]);
  const [type, setType] = useState("");
  const [submitted, setSubmitted] = useState("");

  useEffect(() => {
    const name = query.trim();
    if (name.length < 2) {
      setSuggestions([]);
      return;
    }
    const t = window.setTimeout(() => {
      void fetchAutocomplete(name).then(({ names }) => setSuggestions(names.slice(0, 8)));
    }, 180);
    return () => window.clearTimeout(t);
  }, [query]);

  const built = useMemo(() => {
    const parts: string[] = [];
    const name = submitted.trim();
    if (name) parts.push(name.includes(" ") ? `"${name}"` : name);
    if (colors.length) parts.push(`id<=${colors.join("")}`);
    if (type) parts.push(`t:${type.toLowerCase()}`);
    return parts.join(" ");
  }, [submitted, colors, type]);

  const { cards, total, isLoading, isError, errorMessage } = useSearchStream(built, "name", "asc");

  function toggleColor(id: string) {
    setColors((cur) => (cur.includes(id) ? cur.filter((c) => c !== id) : [...cur, id]));
  }

  function search(name?: string) {
    setSubmitted(name ?? query);
    setSuggestions([]);
  }

  function openCard(card: ScryfallCard) {
    navigate(`/card/${card.id}`);
  }

  return (
    <div className={styles.accountContent} style={{ maxWidth: 960, margin: "1.5rem auto", padding: "0 1rem" }}>
      <h1 className={styles.title}>Simple search</h1>
      <p className={styles.subtitle}>Find a card by name, color, or type.</p>

      <div style={{ position: "relative", marginTop: 12 }}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            search();
          }}
          style={{ display: "flex", gap: 8 }}
        >
          <input
            className={styles.input}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Card name…"
            autoComplete="off"
            autoFocus
          />
          <button type="submit" className={styles.primaryBtn} style={{ width: "auto", padding: "0 1rem" }}>
            Search
          </button>
        </form>
        {suggestions.length > 0 && (
          <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 10, marginTop: 4, border: "1px solid #333", borderRadius: 6, overflow: "hidden", background: "var(--color-surface)" }}>
            {suggestions.map((name) => (
              <button
                key={name}
                type="button"
                className={styles.secondaryBtn}
                style={{ display: "block", width: "100%", textAlign: "left", borderRadius: 0, border: "none", borderBottom: "1px solid #333" }}
                onClick={() => {
                  setQuery(name);
                  search(name);
                }}
              >
                {name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12 }}>
        {COLORS.map((c) => (
          <button
            key={c.id}
            type="button"
            className={styles.secondaryBtn}
            style={{ opacity: colors.includes(c.id) ? 1 : 0.55, fontWeight: colors.includes(c.id) ? 700 : 500 }}
            onClick={() => toggleColor(c.id)}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
        <button
          type="button"
          className={styles.secondaryBtn}
          style={{ opacity: type === "" ? 1 : 0.55 }}
          onClick={() => setType("")}
        >
          Any type
        </button>
        {TYPES.map((t) => (
          <button
            key={t}
            type="button"
            className={styles.secondaryBtn}
            style={{ opacity: type === t ? 1 : 0.55, fontWeight: type === t ? 700 : 500 }}
            onClick={() => setType(type === t ? "" : t)}
          >
            {t}
          </button>
        ))}
      </div>

      <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 12 }}>
        <span className={styles.subtitle} style={{ margin: 0 }}>
          {isLoading ? "Searching…" : isError ? `Error: ${errorMessage || "search failed"}` : built ? `${total || cards.length} cards` : "Enter a name or pick filters"}
        </span>
        {built && (
          <Link to={`/search/results?q=${encodeURIComponent(built)}&mode=standard`} className={styles.secondaryBtn} style={{ textDecoration: "none" }}>
            Open in full results
          </Link>
        )}
      </div>

      {cards.length > 0 && (
        <CardTileField>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 12, marginTop: 16 }}>
            {cards.slice(0, 30).map((card) => (
              <CardTile
                key={card.id}
                face={{ name: card.name, imageUrl: card.image_uris?.normal, scryfallId: card.id, oracleId: card.oracle_id }}
                onOpen={() => openCard(card)}
              />
            ))}
          </div>
        </CardTileField>
      )}

      {!isLoading && built && cards.length === 0 && !isError && (
        <p className={styles.subtitle} style={{ marginTop: 16 }}>No cards matched.</p>
      )}
    </div>
  );
}
