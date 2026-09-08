import { NavLink, Outlet } from "react-router-dom";
import styles from "./AppShell.module.css";

const links = [
  { to: "/search", label: "Search" },
  { to: "/decks", label: "Public Decks" },
  { to: "/login", label: "Log in" },
];

export function AppShell() {
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <NavLink to="/" className={styles.brand} end>
          Deck<span className={styles.brandAccent}>App</span>
        </NavLink>
        <nav className={styles.nav} aria-label="Main">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                isActive
                  ? `${styles.navLink} ${styles.navLinkActive}`
                  : styles.navLink
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}
