import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import transitions from "../styles/pageTransitions.module.css";
import styles from "./LoginPage.module.css";
import { PasswordSetForm } from "./login/PasswordSetForm";
import { AccountPanel } from "./login/AccountPanel";

type Mode = "password" | "magic" | "forgot";

export function LoginPage() {
  const auth = useAuth();
  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  function clearMessages() {
    setError(null);
    setInfo(null);
  }

  async function onPasswordSignIn(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    clearMessages();
    const { error: err } = await auth.signInWithPassword(email.trim(), password);
    setBusy(false);
    if (err) setError(err);
  }

  async function onPasswordSignUp() {
    setBusy(true);
    clearMessages();
    const { error: err } = await auth.signUpWithPassword(email.trim(), password);
    setBusy(false);
    if (err) {
      setError(err);
      return;
    }
    setInfo(
      "Account created. If email confirmation is enabled, check your inbox before signing in."
    );
  }

  async function onMagicLink(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    clearMessages();
    const { error: err } = await auth.signInWithMagicLink(email.trim());
    setBusy(false);
    if (err) {
      setError(err);
      return;
    }
    setInfo(
      "Magic link sent. Check your email and open the link to finish signing in."
    );
  }

  async function onForgotPassword(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    clearMessages();
    const { error: err } = await auth.requestPasswordReset(email.trim());
    setBusy(false);
    if (err) {
      setError(err);
      return;
    }
    setInfo(
      "If an account exists for that email, a password reset link has been sent."
    );
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
    setInfo(
      auth.passwordRecovery
        ? "Password updated. You can sign in with email and password next time."
        : "Password saved. You can use email and password sign-in from now on."
    );
    if (auth.passwordRecovery) {
      auth.clearPasswordRecovery();
    }
  }

  if (auth.loading) {
    return (
      <div className={`${styles.wrap} ${transitions.page}`}>
        <div className={styles.card}>
          <p className={styles.subtitle}>Checking session…</p>
        </div>
      </div>
    );
  }

  if (auth.user && auth.passwordRecovery) {
    return (
      <div className={`${styles.wrap} ${transitions.page}`}>
        <div className={styles.card}>
          <h1 className={styles.title}>Choose a new password</h1>
          <p className={styles.subtitle}>
            You opened a password reset link for{" "}
            <strong>{auth.user.email}</strong>.
          </p>
          <PasswordSetForm
            newPassword={newPassword}
            confirmPassword={confirmPassword}
            setNewPassword={setNewPassword}
            setConfirmPassword={setConfirmPassword}
            busy={busy}
            onSubmit={onSetPassword}
            submitLabel={busy ? "Saving…" : "Update password"}
          />
          {error && (
            <p className={`${styles.message} ${styles.messageError}`} role="alert">
              {error}
            </p>
          )}
          {info && (
            <p className={`${styles.message} ${styles.messageOk}`}>{info}</p>
          )}
        </div>
      </div>
    );
  }

  if (auth.user) {
    return (
      <div className={`${styles.wrap} ${styles.wrapAccount} ${transitions.page}`}>
        <AccountPanel />
      </div>
    );
  }

  return (
    <div className={`${styles.wrap} ${transitions.page}`}>
      <div className={styles.card}>
        <h1 className={styles.title}>Log in</h1>
        <p className={styles.subtitle}>
          Email + password, magic link, or reset a forgotten password.
        </p>

        <div className={styles.tabs} role="tablist">
          {(
            [
              ["password", "Password"],
              ["magic", "Magic link"],
              ["forgot", "Reset"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={mode === id}
              className={`${styles.tab} ${mode === id ? styles.tabActive : ""}`}
              onClick={() => {
                setMode(id);
                clearMessages();
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {mode === "password" && (
          <form onSubmit={onPasswordSignIn}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="login-email">
                Email
              </label>
              <input
                id="login-email"
                className={styles.input}
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="login-password">
                Password
              </label>
              <input
                id="login-password"
                className={styles.input}
                type="password"
                autoComplete="current-password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className={styles.actions}>
              <button type="submit" className={styles.primaryBtn} disabled={busy}>
                {busy ? "Working…" : "Sign in"}
              </button>
              <button
                type="button"
                className={styles.secondaryBtn}
                disabled={busy}
                onClick={onPasswordSignUp}
              >
                Create account
              </button>
              <button
                type="button"
                className={styles.linkBtn}
                onClick={() => {
                  setMode("forgot");
                  clearMessages();
                }}
              >
                Forgot password?
              </button>
            </div>
          </form>
        )}

        {mode === "magic" && (
          <form onSubmit={onMagicLink}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="magic-email">
                Email
              </label>
              <input
                id="magic-email"
                className={styles.input}
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className={styles.actions}>
              <button type="submit" className={styles.primaryBtn} disabled={busy}>
                {busy ? "Sending…" : "Send magic link"}
              </button>
            </div>
          </form>
        )}

        {mode === "forgot" && (
          <form onSubmit={onForgotPassword}>
            <p className={styles.sectionHint}>
              We will email a link to set a new password. After you open it, you
              will choose the password here.
            </p>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="reset-email">
                Email
              </label>
              <input
                id="reset-email"
                className={styles.input}
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className={styles.actions}>
              <button type="submit" className={styles.primaryBtn} disabled={busy}>
                {busy ? "Sending…" : "Send reset link"}
              </button>
              <button
                type="button"
                className={styles.linkBtn}
                onClick={() => {
                  setMode("password");
                  clearMessages();
                }}
              >
                Back to sign in
              </button>
            </div>
          </form>
        )}

        {error && (
          <p className={`${styles.message} ${styles.messageError}`} role="alert">
            {error}
          </p>
        )}
        {info && (
          <p className={`${styles.message} ${styles.messageOk}`}>{info}</p>
        )}

        <div style={{ marginTop: "1.1rem" }}>
          <Link to="/" className={styles.homeLink}>
            ← Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
