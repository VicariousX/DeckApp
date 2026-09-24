import { useEffect, useMemo, useState } from "react";
import { fetchCardsByNames, fetchCollectionByIds, fetchNamedCard } from "../lib/scryfallApi";
import {
  loadDeckTokens,
  mergePieces,
  partsFromCard,
  saveDeckTokens,
  tokenImage,
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
  const [tab, setTab] = useState<"token" | "extra">("token");
  const [openSources, setOpenSources] = useState<string | null>(null);

  useEffect(() => {
    setTokens(loadDeckTokens(deckId));
  }, [deckId]);

  useEffect(() => {
    saveDeckTokens(deckId, tokens);
    onTokensChange?.(tokens);
  }, [deckId, tokens, onTokensChange]);

  async function generate() {
    setBusy(true);
    setError(null);
    const names = [...new Set(cards.map((c) => c.name))];
    try {
      const { byName, error: nErr } = await fetchCardsByNames(names);
      if (nErr && byName.size === 0) {
        setError(nErr);
        setBusy(false);
        return;
      }
      const sources = new Map<string, { name: string; type_line: string; kind: "token" | "extra"; from: string[] }>();
      for (const deckCard of cards) {
        const full = byName.get(deckCard.name.toLowerCase());
        if (!full) continue;
        for (const part of partsFromCard(full)) {
          const cur = sources.get(part.id);
          if (cur) {
            if (!cur.from.includes(deckCard.name)) cur.from.push(deckCard.name);
          } else {
            sources.set(part.id, {
              name: part.name,
              type_line: part.type_line,
              kind: part.kind,
              from: [deckCard.name],
            });
          }
        }
      }
      const ids = [...sources.keys()];
      const { cards: parts, error: pErr } = await fetchCollectionByIds(ids);
      if (pErr && parts.length === 0 && ids.length) setError(pErr);
      const byId = new Map(parts.map((c) => [c.id, c]));
      const auto: DeckToken[] = ids.map((id) => {
        const meta = sources.get(id)!;
        const card = byId.get(id);
        return {
          id,
          name: card?.name ?? meta.name,
          type_line: card?.type_line ?? meta.type_line,
          image: card ? tokenImage(card) : undefined,
          quantity: 1,
          kind: meta.kind,
          sources: meta.from,
          included: true,
          source: "auto",
        };
      });
      setTokens((prev) => mergePieces(auto, prev));
    } catch {
      setError("Could not load related tokens.");
    }
    setBusy(false);
  }

  useEffect(() => {
    if (!cards.length) return;
    const t = window.setTimeout(() => void generate(), 500);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards.map((c) => c.name).sort().join("|")]);

  async function addManual() {
    const name = manual.trim();
    if (!name) return;
    const { card, error: err } = await fetchNamedCard(name, "fuzzy");
    if (err || !card) {
      setError(err ?? "Token not found.");
      return;
    }
    setTokens((prev) => {
      if (prev.some((t) => t.id === card.id)) {
        return prev.map((t) => (t.id === card.id ? { ...t, included: true } : t));
      }
      const kind =
        (card.type_line || "").toLowerCase().includes("token") || card.layout === "token"
          ? "token"
          : "extra";
      return [
        ...prev,
        {
          id: card.id,
          name: card.name,
          type_line: card.type_line,
          image: tokenImage(card),
          quantity: 1,
          kind,
          sources: [],
          included: true,
          source: "manual",
        },
      ];
    });
    setManual("");
  }

  const shown = useMemo(
    () => tokens.filter((t) => t.kind === tab),
    [tokens, tab]
  );

  return (
    <section className={styles.placeholderPanel}>
      <h2 className={styles.sectionLabel}>Tokens & extras</h2>
      <p className={styles.hint}>
        Official printings linked on Scryfall as faces, tokens, and other parts.
      </p>
      <div className={styles.toolRow}>
        <button type="button" className={styles.primaryBtn} disabled={busy} onClick={() => void generate()}>
          {busy ? "Scanning…" : "Refresh from deck"}
        </button>
        <button
          type="button"
          className={tab === "token" ? styles.primaryBtn : styles.ghostBtn}
          onClick={() => setTab("token")}
        >
          Tokens ({tokens.filter((t) => t.kind === "token").length})
        </button>
        <button
          type="button"
          className={tab === "extra" ? styles.primaryBtn : styles.ghostBtn}
          onClick={() => setTab("extra")}
        >
          Extras ({tokens.filter((t) => t.kind === "extra").length})
        </button>
      </div>
      <div className={styles.addRow}>
        <input
          className={styles.input}
          value={manual}
          placeholder="Add token or extra by name"
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
      <div className={styles.tokenGrid}>
        {shown.length === 0 && (
          <p className={styles.hint}>{busy ? "Looking up related printings…" : "None yet."}</p>
        )}
        {shown.map((t) => (
          <article
            key={t.id}
            className={`${styles.tokenTile}${t.included ? "" : ` ${styles.tokenTileOff}`}`}
          >
            {t.image ? (
              <img src={t.image} alt={t.name} className={styles.tokenImg} draggable={false} />
            ) : (
              <div className={styles.tokenImgPh}>{t.name}</div>
            )}
            <div className={styles.tokenMeta}>
              <strong>{t.name}</strong>
              <small>{t.type_line}</small>
              <div className={styles.qtyBtns}>
                <button
                  type="button"
                  title={t.included ? "Exclude" : "Include"}
                  onClick={() =>
                    setTokens((prev) =>
                      prev.map((x) => (x.id === t.id ? { ...x, included: !x.included } : x))
                    )
                  }
                >
                  {t.included ? "−" : "+"}
                </button>
                {t.sources.length > 0 && (
                  <button
                    type="button"
                    title="Generated by"
                    onClick={() => setOpenSources((id) => (id === t.id ? null : t.id))}
                  >
                    ?
                  </button>
                )}
                {t.source === "manual" && (
                  <button
                    type="button"
                    onClick={() => setTokens((prev) => prev.filter((x) => x.id !== t.id))}
                  >
                    ×
                  </button>
                )}
              </div>
              {openSources === t.id && (
                <p className={styles.hint}>From: {t.sources.join(", ")}</p>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
