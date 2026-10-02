import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../auth/AuthProvider";
import {
  deleteCardSkin,
  fetchMyCardSkins,
  setCardSkinPublic,
  skinImageUrl,
  uploadCardSkin,
  type UserCardSkin,
} from "../services/cardSkinService";
import styles from "../pages/LoginPage.module.css";

export function CardSkinsPanel() {
  const user = useAuth().user!;
  const [skins, setSkins] = useState<UserCardSkin[]>([]);
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isPublic, setIsPublic] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function reload() {
    const { skins: rows, error: err } = await fetchMyCardSkins(user.id);
    setSkins(rows);
    if (err) setError(err);
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
    const { error: err } = await uploadCardSkin(user.id, name, file, isPublic);
    setBusy(false);
    if (err) {
      setError(err);
      return;
    }
    setName("");
    setFile(null);
    setInfo(isPublic ? "Skin uploaded and public in TTS." : "Skin uploaded. It stays private until you mark it public.");
    await reload();
  }

  async function onToggle(skin: UserCardSkin) {
    setError(null);
    const { error: err } = await setCardSkinPublic(skin.id, !skin.is_public);
    if (err) {
      setError(err);
      return;
    }
    await reload();
  }

  async function onDelete(skin: UserCardSkin) {
    setError(null);
    const { error: err } = await deleteCardSkin(skin);
    if (err) {
      setError(err);
      return;
    }
    await reload();
  }

  return (
    <>
      <h1 className={styles.title}>Card skins</h1>
      <p className={styles.subtitle}>
        Upload a card back. Public skins show up in the Tabletop Simulator DeckApp selector.
        Private skins stay on your account.
      </p>
      <form onSubmit={(e) => void onUpload(e)}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="skin-name">Name</label>
          <input id="skin-name" className={styles.input} type="text" maxLength={48} value={name} onChange={(e) => setName(e.target.value)} placeholder="Arcane sleeve" required />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="skin-file">Image</label>
          <input id="skin-file" className={styles.input} type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </div>
        <div className={styles.field}>
          <label className={styles.label}>
            <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} /> Public in TTS
          </label>
        </div>
        <button type="submit" className={styles.primaryBtn} disabled={busy}>{busy ? "Uploading..." : "Upload skin"}</button>
      </form>
      {error && <p className={styles.subtitle}>{error}</p>}
      {info && <p className={styles.subtitle}>{info}</p>}
      <div className={styles.themePickerWrap}>
        {skins.map((skin) => {
          const src = skinImageUrl(skin.storage_path);
          return (
            <div key={skin.id} className={styles.field}>
              {src ? <img src={src} alt="" style={{ width: 120, borderRadius: 8 }} /> : null}
              <div>
                <strong>{skin.name}</strong>
                <div>{skin.is_public ? "Public" : "Private"}</div>
                <button type="button" className={styles.secondaryBtn} onClick={() => void onToggle(skin)}>{skin.is_public ? "Make private" : "Make public"}</button>
                <button type="button" className={styles.secondaryBtn} onClick={() => void onDelete(skin)}>Delete</button>
              </div>
            </div>
          );
        })}
        {skins.length === 0 && <p className={styles.subtitle}>No skins yet.</p>}
      </div>
    </>
  );
}
