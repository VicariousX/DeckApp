import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { fetchAutocomplete, fetchNamedCard } from "../lib/scryfallApi";
import styles from "./CardNameSwitcher.module.css";


type Props = {
  currentName: string;
};

export function CardNameSwitcher({ currentName }: Props) {
  const navigate = useNavigate();
  const [query, setQuery] = useState(currentName);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setQuery(currentName);
  }, [currentName]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (q.length < 2 || q === currentName) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      const { names, error: err } = await fetchAutocomplete(q);
      setSuggestions(names.slice(0, 12));
      setError(err);
      setLoading(false);
      setOpen(true);
      setActiveIndex(-1);
    }, 220);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, currentName]);

  async function goToName(name: string) {
    setOpen(false);
    setLoading(true);
    setError(null);
    const { card, error: err } = await fetchNamedCard(name, "exact");
    setLoading(false);
    if (err || !card) {
      setError(err ?? "Card not found");
      return;
    }
    navigate(`/card/${card.id}`);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
      setOpen(true);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const pick =
        activeIndex >= 0 && suggestions[activeIndex]
          ? suggestions[activeIndex]
          : query.trim();
      if (pick) void goToName(pick);
    } else if (e.key === "Escape") {
      setOpen(false);
      setQuery(currentName);
    }
  }

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <label className={styles.label} htmlFor="card-name-switch">
        Jump to card
      </label>
      <div className={styles.inputRow}>
        <input
          id="card-name-switch"
          className={styles.input}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Type a card name…"
          autoComplete="off"
          spellCheck={false}
        />
        {loading && <span className={styles.spinner} aria-hidden />}
      </div>
      {error && <p className={styles.error}>{error}</p>}
      {open && suggestions.length > 0 && (
        <ul className={styles.list} role="listbox">
          {suggestions.map((name, i) => (
            <li key={name} role="option" aria-selected={i === activeIndex}>
              <button
                type="button"
                className={
                  i === activeIndex
                    ? `${styles.item} ${styles.itemActive}`
                    : styles.item
                }
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => void goToName(name)}
              >
                {name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
