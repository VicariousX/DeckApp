import styles from "./PillSwitch.module.css";

type Props = {
  checked: boolean;
  onChange: (on: boolean) => void;
  label: string;
  disabled?: boolean;
};

export function PillSwitch({ checked, onChange, label, disabled }: Props) {
  return (
    <label className={`${styles.switch}${checked ? ` ${styles.on}` : ""}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className={styles.knob} aria-hidden />
      <span className={styles.label}>{label}</span>
    </label>
  );
}
