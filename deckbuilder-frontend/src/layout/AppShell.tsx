import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { AmbientBackdrop } from "../components/AmbientBackdrop";
import { useAuth } from "../auth/AuthProvider";
import { getDisplayName } from "../auth/userDisplay";
import { getLastViewedDeck } from "../lib/deckPreferences";
import styles from "./AppShell.module.css";

export function AppShell() {
  const { user } = useAuth();
  const name = getDisplayName(user);
  const location = useLocation();
  const [decksOpen, setDecksOpen] = useState(false);
  const [lastDeck, setLastDeck] = useState(() => getLastViewedDeck());
  const decksRef = useRef<HTMLDivElement>(null);

  const decksActive =
    location.pathname === "/decks" ||
    location.pathname === "/my-decks" ||
    location.pathname.startsWith("/deck/");

  useEffect(() => {
    setDecksOpen(false);
    // Refresh last-viewed when route changes (deck builder writes localStorage)
    setLastDeck(getLastViewedDeck());
  }, [location.pathname]);

  useEffect(() => {
    if (!decksOpen) return;

    let remove: (() => void) | undefined;

    // Defer so the opening click does not immediately close the menu
    const timer = window.setTimeout(() => {
      function onPointerDown(e: MouseEvent) {
        if (!decksRef.current?.contains(e.target as Node)) {
          setDecksOpen(false);
        }
      }

      function onKey(e: KeyboardEvent) {
        if (e.key === "Escape") setDecksOpen(false);
      }

      document.addEventListener("mousedown", onPointerDown);
      document.addEventListener("keydown", onKey);
      remove = () => {
        document.removeEventListener("mousedown", onPointerDown);
        document.removeEventListener("keydown", onKey);
      };
    }, 0);

    return () => {
      window.clearTimeout(timer);
      remove?.();
    };
  }, [decksOpen]);

  return (
    <div className={styles.shell}>
      <AmbientBackdrop />
      <header className={styles.header}>
        <NavLink to="/" className={styles.brand} end>
          Deck<span className={styles.brandAccent}>App</span>
        </NavLink>
        <nav className={styles.nav} aria-label="Main">
          <div className={styles.searchFly}>
            <NavLink
              to="/search?mode=standard"
              className={() => {
                const onSearch = location.pathname.startsWith("/search");
                return `${styles.navLink} ${styles.searchPrimary}${
                  onSearch ? ` ${styles.navLinkActive}` : ""
                }`;
              }}
            >
              Search
            </NavLink>
            <div className={styles.searchMenu} role="menu">
              <NavLink
                to="/search?mode=standard"
                role="menuitem"
                className={() => {
                  const onSearch = location.pathname.startsWith("/search");
                  const advanced =
                    new URLSearchParams(location.search).get("mode") === "advanced";
                  return `${styles.searchMenuItem}${
                    onSearch && !advanced ? ` ${styles.searchMenuOn}` : ""
                  }`;
                }}
              >
                Standard
              </NavLink>
              <NavLink
                to="/search?mode=advanced"
                role="menuitem"
                className={() => {
                  const onSearch = location.pathname.startsWith("/search");
                  const advanced =
                    new URLSearchParams(location.search).get("mode") === "advanced";
                  return `${styles.searchMenuItem}${
                    onSearch && advanced ? ` ${styles.searchMenuOn}` : ""
                  }`;
                }}
              >
                Advanced
              </NavLink>
            </div>
          </div>

          {user && (
            <NavLink
              to="/drawers"
              className={({ isActive }) =>
                isActive
                  ? `${styles.navLink} ${styles.navLinkActive}`
                  : styles.navLink
              }
            >
              Drawers
            </NavLink>
          )}

          {user ? (
            <div className={styles.decksMenu} ref={decksRef}>
              <button
                type="button"
                className={`${styles.navLink} ${styles.decksTrigger} ${
                  decksActive || decksOpen ? styles.navLinkActive : ""
                }`}
                aria-haspopup="menu"
                aria-expanded={decksOpen}
                onClick={(e) => {
                  e.stopPropagation();
                  setDecksOpen((v) => !v);
                }}
              >
                Decks
                <span
                  className={`${styles.chevron} ${
                    decksOpen ? styles.chevronOpen : ""
                  }`}
                  aria-hidden
                >
                  ▾
                </span>
              </button>
              {decksOpen && (
                <div
                  className={styles.decksDropdown}
                  role="menu"
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  {lastDeck && (
                    <NavLink
                      to={`/deck/${lastDeck.id}`}
                      role="menuitem"
                      className={({ isActive }) =>
                        isActive
                          ? `${styles.decksItem} ${styles.decksItemActive}`
                          : styles.decksItem
                      }
                      onClick={() => setDecksOpen(false)}
                      title={lastDeck.name}
                    >
                      <span className={styles.decksItemLabel}>Last viewed</span>
                      <span className={styles.decksItemSub}>{lastDeck.name}</span>
                    </NavLink>
                  )}
                  <NavLink
                    to="/my-decks"
                    role="menuitem"
                    className={({ isActive }) =>
                      isActive
                        ? `${styles.decksItem} ${styles.decksItemActive}`
                        : styles.decksItem
                    }
                    onClick={() => setDecksOpen(false)}
                  >
                    My decks
                  </NavLink>
                  <NavLink
                    to="/decks"
                    role="menuitem"
                    className={({ isActive }) =>
                      isActive
                        ? `${styles.decksItem} ${styles.decksItemActive}`
                        : styles.decksItem
                    }
                    onClick={() => setDecksOpen(false)}
                  >
                    Public decks
                  </NavLink>
                </div>
              )}
            </div>
          ) : (
            <NavLink
              to="/decks"
              className={({ isActive }) =>
                isActive
                  ? `${styles.navLink} ${styles.navLinkActive}`
                  : styles.navLink
              }
            >
              Public Decks
            </NavLink>
          )}

          {user ? (
            <NavLink
              to="/login"
              className={({ isActive }) =>
                isActive
                  ? `${styles.userLink} ${styles.userLinkActive}`
                  : styles.userLink
              }
              title={user.email ?? name}
            >
              {name}
            </NavLink>
          ) : (
            <NavLink
              to="/login"
              className={({ isActive }) =>
                isActive
                  ? `${styles.navLink} ${styles.navLinkActive}`
                  : styles.navLink
              }
            >
              Log in
            </NavLink>
          )}
        </nav>
      </header>
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}
