import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../auth/AuthProvider";
import {
  deleteCardSleeve,
  fetchMySleeves,
  fetchPublicSleeves,
  setCardSleevePublic,
  sleeveImageUrl,
  sleeveUnlimited,
  uploadCardSleeve,
  type CardSleeve,
} from "../services/cardSleeveService";
import styles from "../pages/SocialPage.module.css";
import { PillSwitch } from "./PillSwitch";

const LIMIT = 5;

export function CardSleevesPanel() {
  const user = useAuth().user!;
  const unlimited = sleeveUnlimited(user);
  const [mine, setMine] = useState<CardSleeve[]>([]);
  const [catalog, setCatalog] = useState<CardSleeve[]>([]);
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isPublic, setIsPublic] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function reload() {
    const [own, pub] = await Promise.all([fetchMySleeves(user.id), fetchPublicSleeves()]);
    setMine(own.sleeves);
    setCatalog(pub.sleeves);
    setError(own.error || pub.error);
  }

  useEffect(() => {
    void reload();
  }, [user.id]);

  async function onUpload(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (!file) {
      setError("Choose an image.");
      return;
    }
    setBusy(true);
    const { error: err } = await uploadCardSleeve(user, name, file, isPublic);
    setBusy(false);
    if (err) {
      setError(err);
      return;
    }
    setName("");
    setFile(null);
    setInfo(isPublic ? "Sleeve uploaded. It is in the Tabletop Simulator list." : "Sleeve uploaded. It stays private until you mark it public.");
    await reload();
  }

  async function onToggle(sleeve: CardSleeve) {
    setError(null);
    const { error: err } = await setCardSleevePublic(sleeve.id, !sleeve.is_public);
    if (err) {
      setError(err);
      return;
    }
    await reload();
  }

  async function onDelete(sleeve: CardSleeve) {
    setError(null);
    const { error: err } = await deleteCardSleeve(sleeve);
    if (err) {
      setError(err);
      return;
    }
    await reload();
  }

  const cap = unlimited ? "No upload limit on this account." : `${mine.length} / ${LIMIT} uploads used.`;

  return (
    <section className={styles.panel}>
      <h2>Sleeves</h2>
      <p className={styles.muted}>
        Upload a card back. Public sleeves show up in the Tabletop Simulator importer. {cap}
      </p>
      <form className={styles.stack} onSubmit={(e) => void onUpload(e)}>
        <input
          value={name}
          maxLength={48}
          onChange={(e) => setName(e.target.value)}
          placeholder="Sleeve name"
          required
        />
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <PillSwitch checked={isPublic} onChange={setIsPublic} label="Public in Tabletop Simulator" />
        <button type="submit" disabled={busy || (!unlimited && mine.length >= LIMIT)}>
          {busy ? "Uploading…" : "Upload sleeve"}
        </button>
      </form>
      {error && <p className={styles.error}>{error}</p>}
      {info && <p className={styles.muted}>{info}</p>}

      <h3>Catalog</h3>
      <div className={styles.sleeveGrid}>
        {catalog.map((sleeve) => (
          <SleeveCard key={sleeve.id} sleeve={sleeve} mine={sleeve.user_id === user.id} onToggle={onToggle} onDelete={onDelete} />
        ))}
        {catalog.length === 0 && <p className={styles.muted}>No public sleeves yet.</p>}
      </div>

      {mine.some((sleeve) => !sleeve.is_public) && (
        <>
          <h3>Private</h3>
          <div className={styles.sleeveGrid}>
            {mine.filter((sleeve) => !sleeve.is_public).map((sleeve) => (
              <SleeveCard key={sleeve.id} sleeve={sleeve} mine onToggle={onToggle} onDelete={onDelete} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function SleeveCard({
  sleeve,
  mine,
  onToggle,
  onDelete,
}: {
  sleeve: CardSleeve;
  mine: boolean;
  onToggle: (sleeve: CardSleeve) => void;
  onDelete: (sleeve: CardSleeve) => void;
}) {
  const src = sleeveImageUrl(sleeve.storage_path);
  return (
    <article className={styles.sleeveCard}>
      {src ? <img src={src} alt="" /> : null}
      <strong>{sleeve.name}</strong>
      <span className={styles.muted}>{sleeve.is_public ? "Public" : "Private"}</span>
      {mine && (
        <div className={styles.row}>
          <button type="button" onClick={() => onToggle(sleeve)}>
            {sleeve.is_public ? "Make private" : "Make public"}
          </button>
          <button type="button" onClick={() => onDelete(sleeve)}>Delete</button>
        </div>
      )}
    </article>
  );
}
