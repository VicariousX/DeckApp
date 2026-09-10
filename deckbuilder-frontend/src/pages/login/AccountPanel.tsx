import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthProvider";
import {
  getAvatarUrl,
  getDisplayName,
  getInitials,
} from "../../auth/userDisplay";
import { PasswordSetForm } from "./PasswordSetForm";
import styles from "../LoginPage.module.css";
import { useTheme, type AppTheme } from "../../theme/ThemeProvider";

type AccountSection = "profile" | "password";

export function AccountPanel() {
  const auth = useAuth();
  const { theme, setTheme } = useTheme();
  const user = auth.user!;
  const [section, setSection] = useState<AccountSection>("profile");

  const [displayName, setDisplayName] = useState(getDisplayName(user));
  const [avatarUrl, setAvatarUrl] = useState(getAvatarUrl(user) ?? "");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    setDisplayName(getDisplayName(user));
    setAvatarUrl(getAvatarUrl(user) ?? "");
  }, [user]);

  function clearMessages() {
    setError(null);
    setInfo(null);
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
            onClick={() => {
              setSection("profile");
              clearMessages();
            }}
          >
            Profile
          </button>
          <button
            type="button"
            className={`${styles.accountNavBtn} ${
              section === "password" ? styles.accountNavBtnActive : ""
            }`}
            onClick={() => {
              setSection("password");
              clearMessages();
            }}
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
              <div className={styles.field}>
                <span className={styles.label}>Theme</span>
                <div className={styles.themeToggle} role="group" aria-label="App theme">
                  <button
                    type="button"
                    className={`${styles.themeOption} ${
                      theme === "premium" ? styles.themeOptionActive : ""
                    }`}
                    onClick={() => setTheme("premium" as AppTheme)}
                  >
                    Premium
                  </button>
                  <button
                    type="button"
                    className={`${styles.themeOption} ${
                      theme === "arcane" ? styles.themeOptionActive : ""
                    }`}
                    onClick={() => setTheme("arcane" as AppTheme)}
                  >
                    Arcane
                  </button>
                </div>
              </div>
              <div className={styles.actions}>
                <button
                  type="submit"
                  className={styles.primaryBtn}
                  disabled={busy}
                >
                  {busy ? "Saving…" : "Save profile"}
                </button>
              </div>
            </form>
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

        <div style={{ marginTop: "1.25rem" }}>
          <Link to="/" className={styles.homeLink}>
            ← Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
