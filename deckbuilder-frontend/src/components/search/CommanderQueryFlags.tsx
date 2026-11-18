import styles from "./CommanderQueryFlags.module.css";

export function CommanderQueryFlags({
  identity,
  applyId,
  isCommander,
  onApplyId,
  onIsCommander,
}: {
  identity?: string;
  applyId: boolean;
  isCommander: boolean;
  onApplyId: (on: boolean) => void;
  onIsCommander: (on: boolean) => void;
}) {
  return (
    <div className={styles.row}>
      {identity ? (
        <button
          type="button"
          className={applyId ? styles.on : styles.pill}
          aria-pressed={applyId}
          onClick={() => onApplyId(!applyId)}
        >
          Apply commander ID
        </button>
      ) : null}
      <button
        type="button"
        className={isCommander ? styles.on : styles.pill}
        aria-pressed={isCommander}
        onClick={() => onIsCommander(!isCommander)}
      >
        Is a commander
      </button>
    </div>
  );
}
