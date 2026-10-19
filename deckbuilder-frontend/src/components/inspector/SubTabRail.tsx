import type { SubTab } from "./types";
import styles from "../CardInspectorModal.module.css";

export function SubTabRail({
  subTabs,
  active,
  onSelect,
}: {
  subTabs: SubTab[];
  active: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className={styles.subTabRail} role="tablist">
      {subTabs.map((sub) => (
        <button
          key={sub.id}
          type="button"
          role="tab"
          aria-selected={active === sub.id}
          className={`${styles.subTab}${
            active === sub.id ? ` ${styles.subTabActive}` : ""
          }`}
          onClick={() => onSelect(sub.id)}
        >
          {sub.label}
        </button>
      ))}
    </div>
  );
}
