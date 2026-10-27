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
import { isDrivePickerConfigured, pickDriveImage } from "../lib/googleDrivePicker";
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

  const driveReady = isDrivePickerConfigured();

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

  async function uploadToR2(
    opts: { file?: File | null; sourceUrl?: string },
    oracleId: string,
    side: "front" | "back"
  ): Promise<string> {
    const body = new FormData();
    body.set("oracle_id", oracleId);
    body.set("side", side);
    if (opts.file) body.set("file", opts.file);
    else if (opts.sourceUrl) body.set("source_url", opts.sourceUrl);
    else throw new Error("No image source.");
    const res = await fetch("/api/proxy-art", { method: "POST", body });
    const data = (await res.json()) as { url?: string; error?: string };
    if (!res.ok || !data.url) throw new Error(data.error || "Upload failed.");
    return data.url;
  }

  async function pickFromDrive(side: "front" | "back") {
    setError(null);
    setInfo(null);
    try {
      const file = await pickDriveImage();
      if (!file) return;
      if (side === "front") setFrontFile(file);
      else setBackFile(file);
      setInfo(`Selected ${file.name} from Google Drive.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Drive picker failed.");
    }
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
      let image = "";
      if (frontFile) {
        image = await uploadToR2({ file: frontFile }, oracleId, "front");
      } else if (imageUrl.trim()) {
        image = await uploadToR2({ sourceUrl: imageUrl.trim() }, oracleId, "front");
      }
      if (!image) {
        setBusy(false);
        setError("Choose an image file, pick from Google Drive, or paste a public URL.");
        return;
      }
      let back = "";
      if (backFile) {
        back = await uploadToR2({ file: backFile }, oracleId, "back");
      } else if (backUrl.trim()) {
        back = await uploadToR2({ sourceUrl: backUrl.trim() }, oracleId, "back");
      }
      const { error: saveErr } = await upsertProxyCard(set.id, {
        oracle_id: oracleId,
        name: card.name,
        image_url: image,
        back_image_url: back || null,
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
        Upload proxy art to Cloudflare R2, pick from Google Drive, or import from a public URL.
        The set is readable by every user. Images are served from the R2 bucket.
      </p>
      {!driveReady && (
        <p className={styles.subtitle}>
          Google Drive picker is not configured. Set VITE_GOOGLE_CLIENT_ID and VITE_GOOGLE_API_KEY to enable it.
        </p>
      )}
      {error && <p className={styles.subtitle} style={{ color: "var(--danger, #c44)" }}>{error}</p>}
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
        <label className={styles.label}>Front image (file)</label>
        <input
          className={styles.input}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          onChange={(e) => setFrontFile(e.target.files?.[0] ?? null)}
        />
        {frontFile && <p className={styles.subtitle}>Selected: {frontFile.name}</p>}
        <button
          type="button"
          className={styles.secondaryBtn}
          disabled={!driveReady || busy}
          onClick={() => void pickFromDrive("front")}
        >
          Pick front from Google Drive
        </button>
      </div>
      <div className={styles.field}>
        <label className={styles.label}>Or import front from URL</label>
        <input
          className={styles.input}
          type="url"
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          placeholder="https://… or public share link"
        />
      </div>
      <div className={styles.field}>
        <label className={styles.label}>Back image (optional file)</label>
        <input
          className={styles.input}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          onChange={(e) => setBackFile(e.target.files?.[0] ?? null)}
        />
        {backFile && <p className={styles.subtitle}>Selected: {backFile.name}</p>}
        <button
          type="button"
          className={styles.secondaryBtn}
          disabled={!driveReady || busy}
          onClick={() => void pickFromDrive("back")}
        >
          Pick back from Google Drive
        </button>
      </div>
      <div className={styles.field}>
        <label className={styles.label}>Or import back from URL</label>
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
