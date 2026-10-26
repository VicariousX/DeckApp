import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { isProxyAdmin } from "../lib/proxyAdmin";
import { fetchAutocomplete, fetchNamedCard } from "../lib/scryfallApi";
import {
  deleteProxyCard,
  ensureDefaultProxySet,
  listProxyCards,
  upsertProxyCard,
  type ProxySet,
  type ProxySetCard,
} from "../services/proxySetService";
import styles from "./LoginPage.module.css";

export function ProxySetPage() {
  const { user, loading } = useAuth();
  const [set, setSet] = useState<ProxySet | null>(null);
  const [cards, setCards] = useState<ProxySetCard[]>([]);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [imageUrl, setImageUrl] = useState("");
  const [backUrl, setBackUrl] = useState("");
  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !isProxyAdmin(user)) return;
    void (async () => {
      const { set: next, error: err } = await ensureDefaultProxySet(user.id);
      if (err) setError(err);
      setSet(next);
      if (next) {
        const { cards: rows, error: listErr } = await listProxyCards(next.id);
        if (listErr) setError(listErr);
        setCards(rows);
      }
    })();
  }, [user]);

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

  async function refresh(setId: string) {
    const { cards: rows } = await listProxyCards(setId);
    setCards(rows);
  }

  async function uploadToR2(file: File, oracleId: string, side: "front" | "back"): Promise<string> {
    const body = new FormData();
    body.set("file", file);
    body.set("oracle_id", oracleId);
    body.set("side", side);
    const res = await fetch("/api/proxy-art", { method: "POST", body });
    const data = (await res.json()) as { url?: string; error?: string };
    if (!res.ok || !data.url) throw new Error(data.error || "Upload failed.");
    return data.url;
  }

  async function addCard(name: string) {
    if (!set || !user) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    const { card, error: lookupErr } = await fetchNamedCard(name);
    if (lookupErr || !card) {
      setBusy(false);
      setError(lookupErr ?? "Card not found.");
      return;
    }
    const oracleId = card.oracle_id || card.id;
    try {
      const image = frontFile ? await uploadToR2(frontFile, oracleId, "front") : imageUrl.trim();
      if (!image) {
        setBusy(false);
        setError("Choose an image file or paste a Cloudflare URL.");
        return;
      }
      const back = backFile ? await uploadToR2(backFile, oracleId, "back") : backUrl.trim();
      const { error: saveErr } = await upsertProxyCard(set.id, {
        oracle_id: oracleId,
        name: card.name,
        image_url: image,
        back_image_url: back,
      });
      setBusy(false);
      if (saveErr) {
        setError(saveErr);
        return;
      }
      setQuery("");
      setImageUrl("");
      setBackUrl("");
      setFrontFile(null);
      setBackFile(null);
      setSuggestions([]);
      setInfo(`${card.name} added to the proxy set.`);
      await refresh(set.id);
    } catch (err) {
      setBusy(false);
      setError(err instanceof Error ? err.message : "Upload failed.");
    }
  }
    setBusy(false);
    if (saveErr) {
      setError(saveErr);
      return;
    }
    setQuery("");
    setImageUrl("");
    setBackUrl("");
    setSuggestions([]);
    setInfo(`${card.name} added to the proxy set.`);
    await refresh(set.id);
  }

  async function remove(card: ProxySetCard) {
    if (!set) return;
    const { error: err } = await deleteProxyCard(card.id);
    if (err) {
      setError(err);
      return;
    }
    await refresh(set.id);
  }

  if (loading) return null;
  if (!user || !isProxyAdmin(user)) return <Navigate to="/login" replace />;

  return (
    <div className={styles.accountContent} style={{ maxWidth: 760, margin: "0 auto", padding: "1.5rem" }}>
      <h1 className={styles.title}>Proxy set</h1>
      <p className={styles.subtitle}>
        Upload proxy art to Cloudflare R2, or paste an existing public URL.
        The set is readable by every user. Images are served from the R2 bucket.
      </p>
      {error && <p className={styles.subtitle}>{error}</p>}
      {info && <p className={styles.subtitle}>{info}</p>}

      <div className={styles.field}>
        <label className={styles.label}>Card name</label>
        <input
          className={styles.input}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search Scryfall…"
          autoComplete="off"
        />
        {suggestions.length > 0 && (
          <div>
            {suggestions.map((name) => (
              <button
                key={name}
                type="button"
                className={styles.secondaryBtn}
                onClick={() => setQuery(name)}
              >
                {name}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className={styles.field}>
        <label className={styles.label}>Front image</label>
        <input
          className={styles.input}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          onChange={(e) => setFrontFile(e.target.files?.[0] ?? null)}
        />
      </div>
      <div className={styles.field}>
        <label className={styles.label}>Or Cloudflare image URL</label>
        <input
          className={styles.input}
          type="url"
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          placeholder="https://…"
        />
      </div>
      <div className={styles.field}>
        <label className={styles.label}>Back image (optional)</label>
        <input
          className={styles.input}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          onChange={(e) => setBackFile(e.target.files?.[0] ?? null)}
        />
      </div>
      <div className={styles.field}>
        <label className={styles.label}>Or back image URL</label>
        <input
          className={styles.input}
          type="url"
          value={backUrl}
          onChange={(e) => setBackUrl(e.target.value)}
          placeholder="https://…"
        />
      </div>
      <button
        type="button"
        className={styles.primaryBtn}
        disabled={busy || !query.trim() || (!frontFile && !imageUrl.trim())}
        onClick={() => void addCard(query.trim())}
      >
        {busy ? "Saving…" : "Add to proxy set"}
      </button>

      <h2 className={styles.title} style={{ marginTop: "1.5rem" }}>
        {cards.length} card{cards.length === 1 ? "" : "s"}
      </h2>
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {cards.map((card) => (
          <li key={card.id} style={{ display: "flex", gap: "0.75rem", alignItems: "center", padding: "0.45rem 0" }}>
            <img src={card.image_url} alt="" style={{ width: 48, borderRadius: 4 }} />
            <span style={{ flex: 1 }}>{card.name}</span>
            <button type="button" className={styles.secondaryBtn} onClick={() => void remove(card)}>
              Remove
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
