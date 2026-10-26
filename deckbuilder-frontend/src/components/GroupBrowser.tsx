import type { DragEventHandler, ReactNode } from "react";
import styles from "../pages/DrawersPage.module.css";

export type ViewMode = "text" | "image";

type ToggleProps = {
  mode: ViewMode;
  onChange: (mode: ViewMode) => void;
  label?: string;
};

export function ViewModeToggle({ mode, onChange, label = "View mode" }: ToggleProps) {
  return (
    <div className={styles.viewToggle} role="group" aria-label={label}>
      <button
        type="button"
        className={`${styles.viewBtn}${mode === "text" ? ` ${styles.viewBtnActive}` : ""}`}
        onClick={() => onChange("text")}
        aria-pressed={mode === "text"}
      >
        Text
      </button>
      <button
        type="button"
        className={`${styles.viewBtn}${mode === "image" ? ` ${styles.viewBtnActive}` : ""}`}
        onClick={() => onChange("image")}
        aria-pressed={mode === "image"}
      >
        Images
      </button>
    </div>
  );
}

type ShellProps = {
  title: string;
  subtitle: string;
  headerTools?: ReactNode;
  sidebar: ReactNode;
  children: ReactNode;
  error?: string | null;
  /** Extra class on the outer page (e.g. page transitions). */
  className?: string;
  onDragOver?: DragEventHandler<HTMLDivElement>;
  onDrop?: DragEventHandler<HTMLDivElement>;
};

export function GroupPageShell({
  title,
  subtitle,
  headerTools,
  sidebar,
  children,
  error,
  className,
  onDragOver,
  onDrop,
}: ShellProps) {
  return (
    <div
      className={className ? `${styles.page} ${className}` : styles.page}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>{title}</h1>
          <p className={styles.subtitle}>{subtitle}</p>
        </div>
        {headerTools && <div className={styles.headerTools}>{headerTools}</div>}
      </header>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <div className={styles.layout}>
        <aside className={styles.sidebar}>{sidebar}</aside>
        <section className={styles.main}>{children}</section>
      </div>
    </div>
  );
}

type SidebarListProps = {
  heading: string;
  children: ReactNode;
};

export function GroupSidebar({ heading, children }: SidebarListProps) {
  return (
    <>
      <div className={styles.sidebarHead}>{heading}</div>
      {children}
    </>
  );
}

export function GroupSidebarList({ children }: { children: ReactNode }) {
  return <ul className={styles.drawerList}>{children}</ul>;
}

type ItemProps = {
  name: string;
  meta?: ReactNode;
  active: boolean;
  onClick: () => void;
};

export function GroupSidebarItem({ name, meta, active, onClick }: ItemProps) {
  return (
    <li>
      <button
        type="button"
        className={`${styles.drawerItem}${active ? ` ${styles.drawerItemActive}` : ""}`}
        onClick={onClick}
      >
        <span className={styles.drawerName}>{name}</span>
        {meta && <span className={styles.drawerCountMeta}>{meta}</span>}
      </button>
    </li>
  );
}
