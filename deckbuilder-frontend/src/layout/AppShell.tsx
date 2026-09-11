import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import {
  getAvatarUrl,
  getDisplayName,
  getInitials,
} from "../auth/userDisplay";
import { getLastViewedDeck } from "../lib/deckPreferences";
import styles from "./AppShell.module.css";

export function AppShell() {
  const { user } = useAuth();
  const name = getDisplayName(user);
  const avatar = getAvatarUrl(user);
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
      <header className={styles.header}>
        <NavLink to="/" className={styles.brand} end>
          Deck<span className={styles.brandAccent}>App</span>
        </NavLink>
        <nav className={styles.nav} aria-label="Main">
          <NavLink
            to="/search"
            className={({ isActive }) =>
              isActive
                ? `${styles.navLink} ${styles.navLinkActive}`
                : styles.navLink
            }
          >
            Search
          </NavLink>

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
                  ? `${styles.accountChip} ${styles.accountChipActive}`
                  : styles.accountChip
              }
              title={user.email ?? name}
            >
              <span className={styles.accountChipAvatar} aria-hidden>
                {avatar ? (
                  <img src={avatar} alt="" className={styles.accountChipImg} />
                ) : (
                  getInitials(user)
                )}
              </span>
              <span className={styles.accountChipName}>{name}</span>
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
