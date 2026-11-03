import type { ReactNode } from "react";
import styles from "../pages/LoginPage.module.css";

type ErrorNoticeProps = {
  message: string | null | undefined;
  onRetry?: () => void;
  onDismiss?: () => void;
  children?: ReactNode;
};

/**
 * Consistent error surface with optional retry and dismiss.
 * Use wherever an async action can fail and the user can recover.
 */
export function ErrorNotice({ message, onRetry, onDismiss, children }: ErrorNoticeProps) {
  if (!message) return null;
  return (
    <div
      role="alert"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        flexWrap: "wrap",
        padding: "8px 12px",
        borderRadius: 6,
        background: "color-mix(in srgb, var(--danger, #c44) 12%, transparent)",
        border: "1px solid color-mix(in srgb, var(--danger, #c44) 40%, transparent)",
        margin: "0.5rem 0",
      }}
    >
      <span style={{ flex: 1, color: "var(--danger, #c44)", fontSize: "0.9rem" }}>{message}</span>
      {children}
      {onRetry && (
        <button type="button" className={styles.secondaryBtn} style={{ width: "auto", padding: "4px 10px" }} onClick={onRetry}>
          Retry
        </button>
      )}
      {onDismiss && (
        <button
          type="button"
          aria-label="Dismiss"
          onClick={onDismiss}
          style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", padding: "0 4px" }}
        >
          ×
        </button>
      )}
    </div>
  );
}
