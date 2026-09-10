import type { FormEvent } from "react";
import styles from "../LoginPage.module.css";

type Props = {
  newPassword: string;
  confirmPassword: string;
  setNewPassword: (v: string) => void;
  setConfirmPassword: (v: string) => void;
  busy: boolean;
  onSubmit: (e: FormEvent) => void;
  submitLabel: string;
};

export function PasswordSetForm({
  newPassword,
  confirmPassword,
  setNewPassword,
  setConfirmPassword,
  busy,
  onSubmit,
  submitLabel,
}: Props) {
  return (
    <form onSubmit={onSubmit}>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="new-password">
          New password
        </label>
        <input
          id="new-password"
          className={styles.input}
          type="password"
          autoComplete="new-password"
          required
          minLength={6}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
      </div>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="confirm-password">
          Confirm password
        </label>
        <input
          id="confirm-password"
          className={styles.input}
          type="password"
          autoComplete="new-password"
          required
          minLength={6}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
      </div>
      <div className={styles.actions}>
        <button type="submit" className={styles.primaryBtn} disabled={busy}>
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
