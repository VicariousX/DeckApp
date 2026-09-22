import { useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../../auth/AuthProvider";
import {
  getAvatarUrl,
  getDisplayName,
  getInitials,
} from "../../auth/userDisplay";
import { PasswordSetForm } from "./PasswordSetForm";
import styles from "../LoginPage.module.css";
import { ThemePicker } from "../../components/ThemePicker";
import { BulkDataPanel } from "../../components/BulkDataPanel";
import {
  clearRandomHistory,
  readRandomHistory,
  type RandomHistoryEntry,
} from "../../lib/randomCardHistory";
import { CardInspectorModal } from "../../components/CardInspectorModal";

type AccountSection = "profile" | "themes" | "data" | "random" | "password";

function sectionFromSearch(raw: string | null): AccountSection {
  if (
    raw === "themes" ||
    raw === "password" ||
    raw === "profile" ||
    raw === "data" ||
    raw === "random"
  ) {
    return raw;
  }
  return "profile";
}

export function AccountPanel() {
  const auth = useAuth();
  const user = auth.user!;
  const [searchParams, setSearchParams] = useSearchParams();
  const [section, setSection] = useState<AccountSection>(() =>
    sectionFromSearch(searchParams.get("tab"))
  );

  const [displayName, setDisplayName] = useState(getDisplayName(user));
  const [avatarUrl, setAvatarUrl] = useState(getAvatarUrl(user) ?? "");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [randomHistory, setRandomHistory] = useState<RandomHistoryEntry[]>(() =>
    readRandomHistory(user.id)
  );
  const [historyCardId, setHistoryCardId] = useState<string | null>(null);

  useEffect(() => {
    const next = sectionFromSearch(searchParams.get("tab"));
    setSection(next);
    if (next === "random") setRandomHistory(readRandomHistory(user.id));
  }, [searchParams, user.id]);

  useEffect(() => {
    setDisplayName(getDisplayName(user));
    setAvatarUrl(getAvatarUrl(user) ?? "");
  }, [user]);

  function clearMessages() {
    setError(null);
    setInfo(null);
  }

  function goSection(next: AccountSection) {
    setSection(next);
    clearMessages();
    setSearchParams(next === "profile" ? {} : { tab: next }, { replace: true });
  }

  async function onSaveProfile(e: FormEvent) {
    e.preventDefault();
    clearMessages();
    if (!displayName.trim()) {
      setError("Display name cannot be empty.");
      return;
    }
    setBusy(true);
    const { error: err } = await auth.updateProfile({
      display_name: displayName.trim(),
      avatar_url: avatarUrl.trim(),
    });
    setBusy(false);
    if (err) {
      setError(err);
      return;
    }
    setInfo("Profile saved.");
  }

  async function onSetPassword(e: FormEvent) {
    e.preventDefault();
    clearMessages();
    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    const { error: err } = await auth.updatePassword(newPassword);
    setBusy(false);
    if (err) {
      setError(err);
      return;
    }
    setNewPassword("");
    setConfirmPassword("");
    setInfo("Password saved. You can use email and password sign-in from now on.");
  }

  const avatar = getAvatarUrl(user);

  return (
    <div className={styles.accountLayout}>
      <aside className={styles.accountMenu} aria-label="Account settings">
        <div className={styles.accountIdentity}>
          <div className={styles.accountAvatar} aria-hidden>
            {avatar ? (
              <img src={avatar} alt="" className={styles.accountAvatarImg} />
            ) : (
              <span>{getInitials(user)}</span>
            )}
          </div>
          <div className={styles.accountIdentityText}>
            <div className={styles.accountName}>{getDisplayName(user)}</div>
            <div className={styles.accountEmail}>{user.email}</div>
          </div>
        </div>

        <nav className={styles.accountNav}>
          <button
            type="button"
            className={`${styles.accountNavBtn} ${
              section === "profile" ? styles.accountNavBtnActive : ""
            }`}
            onClick={() => goSection("profile")}
          >
            Profile
          </button>
          <button
            type="button"
            className={`${styles.accountNavBtn} ${
              section === "themes" ? styles.accountNavBtnActive : ""
            }`}
            onClick={() => goSection("themes")}
          >
            Themes
          </button>
          <button
            type="button"
            className={`${styles.accountNavBtn} ${
              section === "data" ? styles.accountNavBtnActive : ""
            }`}
            onClick={() => goSection("data")}
          >
            Card data
          </button>
          <button
            type="button"
            className={`${styles.accountNavBtn} ${
              section === "random" ? styles.accountNavBtnActive : ""
            }`}
            onClick={() => goSection("random")}
          >
            Random history
          </button>
          <button
            type="button"
            className={`${styles.accountNavBtn} ${
              section === "password" ? styles.accountNavBtnActive : ""
            }`}
            onClick={() => goSection("password")}
          >
            Password
          </button>
        </nav>

        <button
          type="button"
          className={styles.secondaryBtn}
          onClick={() => auth.signOut()}
        >
          Sign out
        </button>
      </aside>

      <div className={styles.accountContent}>
        {section === "profile" && (
          <>
            <h1 className={styles.title}>Profile</h1>
            <p className={styles.subtitle}>
              Your display name shows in the header. Avatar accepts an image URL
              for now (upload support can come later).
            </p>
            <form onSubmit={onSaveProfile}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="display-name">
                  Display name
                </label>
                <input
                  id="display-name"
                  className={styles.input}
                  type="text"
                  autoComplete="nickname"
                  required
                  maxLength={64}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="avatar-url">
                  Profile picture URL
                </label>
                <input
                  id="avatar-url"
                  className={styles.input}
                  type="url"
                  placeholder="https://…"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                />
              </div>
              {avatarUrl.trim() && (
                <div className={styles.avatarPreviewWrap}>
                  <img
                    src={avatarUrl.trim()}
                    alt="Preview"
                    className={styles.avatarPreview}
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                </div>
              )}
              <button
                type="submit"
                className={styles.primaryBtn}
                disabled={busy}
              >
                {busy ? "Saving…" : "Save profile"}
              </button>
            </form>
          </>
        )}

        {section === "themes" && (
          <>
            <h1 className={styles.title}>Themes</h1>
            <p className={styles.subtitle}>
              Choose a look for the whole app. Guild themes follow two-color
              identities. Later, finishing a deck in a theme’s colors can unlock
              that theme.
            </p>
            <div className={styles.themePickerWrap}>
              <ThemePicker />
            </div>
          </>
        )}

        {section === "data" && (
          <>
            <h1 className={styles.title}>Card data</h1>
            <p className={styles.subtitle}>
              Stay on the live throttled API, or download Scryfall’s official bulk
              files onto this device. Downloads come from data.scryfall.io — we
              do not host the catalog. Advanced syntax search always stays live.
            </p>
            <BulkDataPanel />
          </>
        )}

        {section === "random" && (
          <>
            <h1 className={styles.title}>Random history</h1>
            <p className={styles.subtitle}>
              Cards drawn from the landing Random card rail.
            </p>
            {randomHistory.length === 0 ? (
              <p className={styles.subtitle}>No random cards yet.</p>
            ) : (
              <ul className={styles.randomHistory}>
                {randomHistory.map((e) => (
                  <li key={`${e.id}-${e.at}`} className={styles.randomHistoryItem}>
                    <button
                      type="button"
                      className={styles.randomHistoryOpen}
                      onClick={() => setHistoryCardId(e.id)}
                    >
                      {e.image ? (
                        <img src={e.image} alt="" className={styles.randomHistoryThumb} />
                      ) : (
                        <span className={styles.randomHistoryThumb} />
                      )}
                      <span>
                        <strong>{e.name}</strong>
                        <em>
                          {new Date(e.at).toLocaleString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </em>
                      </span>
                    </button>
                    <Link to={`/card/${e.id}`} className={styles.inlineLink}>
                      Card page
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {randomHistory.length > 0 && (
              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={() => {
                  clearRandomHistory(user.id);
                  setRandomHistory([]);
                }}
              >
                Clear history
              </button>
            )}
            {historyCardId && (
              <CardInspectorModal
                scryfallId={historyCardId}
                name={
                  randomHistory.find((e) => e.id === historyCardId)?.name
                }
                imageUrl={
                  randomHistory.find((e) => e.id === historyCardId)?.image ??
                  undefined
                }
                onClose={() => setHistoryCardId(null)}
              />
            )}
          </>
        )}

        {section === "password" && (
          <>
            <h1 className={styles.title}>Password</h1>
            <p className={styles.subtitle}>
              Set or change a password so you can sign in without a magic link.
            </p>
            <PasswordSetForm
              newPassword={newPassword}
              confirmPassword={confirmPassword}
              setNewPassword={setNewPassword}
              setConfirmPassword={setConfirmPassword}
              busy={busy}
              onSubmit={onSetPassword}
              submitLabel={busy ? "Saving…" : "Save password"}
            />
          </>
        )}

        {error && (
          <p className={`${styles.message} ${styles.messageError}`} role="alert">
            {error}
          </p>
        )}
        {info && (
          <p className={`${styles.message} ${styles.messageOk}`}>{info}</p>
        )}

        <div className={styles.footerLink}>
          <Link to="/" className={styles.homeLink}>
            ← Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
