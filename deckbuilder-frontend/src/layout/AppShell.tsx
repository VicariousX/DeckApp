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
  const [searchOpen, setSearchOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const isPlay = location.pathname.startsWith("/play");
  const [playNavHidden, setPlayNavHidden] = useState(
    () => localStorage.getItem("deckapp.playHideNav") === "1"
  );
  const [lastDeck, setLastDeck] = useState(() => getLastViewedDeck());
  const decksRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const libraryRef = useRef<HTMLDivElement>(null);

  const decksActive =
    location.pathname === "/decks" ||
    location.pathname === "/my-decks" ||
    location.pathname.startsWith("/deck/");

  useEffect(() => {
    setDecksOpen(false);
    setSearchOpen(false);
    setLibraryOpen(false);
    setLastDeck(getLastViewedDeck());
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!isPlay) {
      document.body.classList.remove("play-nav-hidden");
      return;
    }
    document.body.classList.toggle("play-nav-hidden", playNavHidden);
    localStorage.setItem("deckapp.playHideNav", playNavHidden ? "1" : "0");
    return () => document.body.classList.remove("play-nav-hidden");
  }, [isPlay, playNavHidden]);

  const searchMode =
    location.pathname.startsWith("/search") &&
    new URLSearchParams(location.search).get("mode") === "advanced"
      ? "advanced"
      : location.pathname.startsWith("/search")
        ? "standard"
        : null;
  const searchLabel =
    searchMode === "advanced"
      ? "Advanced"
      : searchMode === "standard"
        ? "Standard"
        : "Search";

  useEffect(() => {
    if (!decksOpen && !searchOpen && !libraryOpen) return;

    let remove: (() => void) | undefined;

    // Defer so the opening click does not immediately close the menu
    const timer = window.setTimeout(() => {
      function onPointerDown(e: MouseEvent) {
        const t = e.target as Node;
        if (!decksRef.current?.contains(t)) setDecksOpen(false);
        if (!searchRef.current?.contains(t)) setSearchOpen(false);
        if (!libraryRef.current?.contains(t)) setLibraryOpen(false);
      }

      function onKey(e: KeyboardEvent) {
        if (e.key === "Escape") {
          setDecksOpen(false);
          setSearchOpen(false);
          setLibraryOpen(false);
        }
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
  }, [decksOpen, searchOpen, libraryOpen]);

  return (
    <div className={styles.shell}>
      <AmbientBackdrop />
      <div className={styles.headerWrap}>
      <header className={styles.header}>
        <NavLink to="/" className={styles.brand} end>
          Deck<span className={styles.brandAccent}>App</span>
        </NavLink>
        <nav className={styles.nav} aria-label="Main">
          <div className={styles.decksMenu} ref={searchRef}>
            <button
              type="button"
              className={`${styles.navLink} ${styles.decksTrigger} ${
                searchMode || searchOpen ? styles.navLinkActive : ""
              }`}
              aria-haspopup="menu"
              aria-expanded={searchOpen}
              onClick={(e) => {
                e.stopPropagation();
                setSearchOpen((v) => !v);
                setDecksOpen(false);
                setLibraryOpen(false);
              }}
            >
              {searchLabel}
              <span
                className={`${styles.chevron} ${
                  searchOpen ? styles.chevronOpen : ""
                }`}
                aria-hidden
              >
                ▾
              </span>
            </button>
            {searchOpen && (
              <div
                className={styles.decksDropdown}
                role="menu"
                onMouseDown={(e) => e.stopPropagation()}
              >
                <NavLink
                  to="/search?mode=standard"
                  role="menuitem"
                  className={() =>
                    searchMode === "standard"
                      ? `${styles.decksItem} ${styles.decksItemActive}`
                      : styles.decksItem
                  }
                  onClick={() => setSearchOpen(false)}
                >
                  Standard
                </NavLink>
                <NavLink
                  to="/search?mode=advanced"
                  role="menuitem"
                  className={() =>
                    searchMode === "advanced"
                      ? `${styles.decksItem} ${styles.decksItemActive}`
                      : styles.decksItem
                  }
                  onClick={() => setSearchOpen(false)}
                >
                  Advanced
                </NavLink>
              </div>
            )}
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
          <div className={styles.decksMenu} ref={libraryRef}>
            <button
              type="button"
              className={`${styles.navLink} ${styles.decksTrigger} ${
                libraryOpen ||
                location.pathname.startsWith("/combos") ||
                location.pathname.startsWith("/formats") ||
                location.pathname.startsWith("/collections")
                  ? styles.navLinkActive
                  : ""
              }`}
              aria-haspopup="menu"
              aria-expanded={libraryOpen}
              onClick={(e) => {
                e.stopPropagation();
                setLibraryOpen((v) => !v);
                setSearchOpen(false);
                setDecksOpen(false);
              }}
            >
              Library
              <span
                className={`${styles.chevron} ${libraryOpen ? styles.chevronOpen : ""}`}
                aria-hidden
              >
                ▾
              </span>
            </button>
            {libraryOpen && (
              <div
                className={styles.decksDropdown}
                role="menu"
                onMouseDown={(e) => e.stopPropagation()}
              >
                <NavLink to="/combos" role="menuitem" className={styles.decksItem} onClick={() => setLibraryOpen(false)}>
                  Combos
                </NavLink>
                <NavLink to="/formats" role="menuitem" className={styles.decksItem} onClick={() => setLibraryOpen(false)}>
                  Formats
                </NavLink>
                <NavLink to="/collections" role="menuitem" className={styles.decksItem} onClick={() => setLibraryOpen(false)}>
                  Collections
                </NavLink>
              </div>
            )}
          </div>

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
                setSearchOpen(false);
                setLibraryOpen(false);
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
      {isPlay && (
        <button
          type="button"
          className={styles.playNavToggle}
          aria-label={playNavHidden ? "Show navigation" : "Hide navigation"}
          onClick={() => setPlayNavHidden((v) => !v)}
        >
          {playNavHidden ? "▾" : "▴"}
        </button>
      )}
      </div>
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}
