import { Link } from "react-router-dom";
import styles from "./SearchModeSwitch.module.css";

const MODES = [
  { id: "simple", label: "Simple", to: "/search/simple" },
  { id: "standard", label: "Standard", to: "/search?mode=standard" },
  { id: "advanced", label: "Advanced", to: "/search?mode=advanced" },
] as const;

export function SearchModeSwitch({ mode }: { mode: "simple" | "standard" | "advanced" }) {
  const index = Math.max(0, MODES.findIndex((item) => item.id === mode));
  return (
    <div className={styles.switch} role="tablist" aria-label="Search mode" style={{ ["--i" as string]: index }}>
      <span className={styles.thumb} aria-hidden />
      {MODES.map((item) => (
        <Link
          key={item.id}
          to={item.to}
          role="tab"
          aria-selected={item.id === mode}
          className={item.id === mode ? styles.on : styles.link}
        >
          {item.label}
        </Link>
      ))}
    </div>
  );
}
