import { useEffect, useState } from "react";
import { fetchNamedCard } from "../lib/scryfallApi";
import {
  loadDeckTokens,
  mergeAutoTokens,
  parseTokensFromOracle,
  saveDeckTokens,
  type DeckToken,
} from "../lib/deck/deckTokens";
import type { DeckCard } from "../types/deck";
import styles from "../pages/DeckBuilderPage.module.css";

type Props = {
  deckId: string;
  cards: DeckCard[];
  onTokensChange?: (tokens: DeckToken[]) => void;
};

export function DeckTokensPanel({ deckId, cards, onTokensChange }: Props) {
  const [tokens, setTokens] = useState<DeckToken[]>(() => loadDeckTokens(deckId));
  const [busy, setBusy] = useState(false);
  const [manual, setManual] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTokens(loadDeckTokens(deckId));
  }, [deckId]);

  useEffect(() => {
    saveDeckTokens(deckId, tokens);
    onTokensChange?.(tokens);
  }, [deckId, tokens, onTokensChange]);

  async function generate(mergeManual = true) {
    setBusy(true);
    setError(null);
    const unique = [...new Map(cards.map((c) => [c.name, c])).values()];
    const auto: DeckToken[] = [];
    try {
      await Promise.all(
        unique.map(async (c) => {
          const { card } = await fetchNamedCard(c.name, "fuzzy");
          const text = [
            card?.oracle_text ?? "",
            ...(card?.card_faces ?? []).map((f) => f.oracle_text ?? ""),
          ].join(" ");
          if (!text) return;
          auto.push(...parseTokensFromOracle(text, c.name));
        })
      );
      const manualKeep = mergeManual ? tokens.filter((t) => t.source === "manual") : [];
      setTokens(mergeAutoTokens(auto, manualKeep));
    } catch {
      setError("Could not scan cards for tokens.");
    }
    setBusy(false);
  }

  useEffect(() => {
    if (!cards.length) return;
    const t = window.setTimeout(() => {
      void generate(true);
    }, 400);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards.map((c) => `${c.name}:${c.quantity}`).join("|")]);

  async function addManual() {
    const name = manual.trim();
    if (!name) return;
    const { card } = await fetchNamedCard(name, "fuzzy");
    const resolved = card?.name ?? name;
    setTokens((prev) => {
      if (prev.some((t) => t.name.toLowerCase() === resolved.toLowerCase())) return prev;
      return [
        ...prev,
        {
          id: `man-${Date.now()}`,
          name: resolved,
          quantity: 1,
          source: "manual",
        },
      ];
    });
    setManual("");
  }

  return (
    <section className={styles.placeholderPanel}>
      <h2 className={styles.sectionLabel}>Tokens</h2>
      <p className={styles.hint}>
        Auto-filled from card text when the list changes. Add extras by name.
      </p>
      <div className={styles.toolRow}>
        <button
          type="button"
          className={styles.primaryBtn}
          disabled={busy}
          onClick={() => void generate(true)}
        >
          {busy ? "Scanning…" : "Generate deck tokens"}
        </button>
      </div>
      <div className={styles.addRow}>
        <input
          className={styles.input}
          value={manual}
          placeholder="Add token by name"
          onChange={(e) => setManual(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void addManual();
            }
          }}
        />
        <button type="button" className={styles.ghostBtn} onClick={() => void addManual()}>
          Add
        </button>
      </div>
      {error && <p className={styles.error}>{error}</p>}
      <ul className={styles.statsList}>
        {tokens.length === 0 && <li className={styles.hint}>No tokens yet.</li>}
        {tokens.map((t) => (
          <li key={t.id} className={styles.tokenRow}>
            <span>
              {t.name}{" "}
              <em className={styles.hint}>
                ×{t.quantity}
                {t.source === "auto" ? " · auto" : " · manual"}
                {t.from ? ` · ${t.from}` : ""}
              </em>
            </span>
            <span className={styles.qtyBtns}>
              <button
                type="button"
                onClick={() =>
                  setTokens((prev) =>
                    prev.map((x) =>
                      x.id === t.id ? { ...x, quantity: Math.max(1, x.quantity - 1) } : x
                    )
                  )
                }
              >
                −
              </button>
              <button
                type="button"
                onClick={() =>
                  setTokens((prev) =>
                    prev.map((x) => (x.id === t.id ? { ...x, quantity: x.quantity + 1 } : x))
                  )
                }
              >
                +
              </button>
              <button
                type="button"
                onClick={() => setTokens((prev) => prev.filter((x) => x.id !== t.id))}
              >
                ×
              </button>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
