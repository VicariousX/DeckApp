import styles from "./CopyReadyDialog.module.css";

type Props = {
  title: string;
  body: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void;
  onCancel: () => void;
  busy?: boolean;
  extra?: { label: string; onClick: () => void };
};

export function CopyReadyDialog({
  title,
  body,
  confirmLabel = "Continue",
  cancelLabel = "Close",
  onConfirm,
  onCancel,
  busy,
  extra,
}: Props) {
  return (
    <div className={styles.backdrop} role="presentation" onMouseDown={onCancel}>
      <div
        className={styles.dialog}
        role="alertdialog"
        aria-labelledby="copy-dialog-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 id="copy-dialog-title">{title}</h2>
        <p>{body}</p>
        <div className={styles.actions}>
          <button type="button" className={styles.secondary} onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </button>
          {extra && (
            <button type="button" className={styles.secondary} onClick={extra.onClick}>
              {extra.label}
            </button>
          )}
          {onConfirm && (
            <button type="button" className={styles.primary} onClick={onConfirm} disabled={busy}>
              {busy ? "Working…" : confirmLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
