import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { AmbientBackdrop } from "../components/AmbientBackdrop";
import { SettingsButton, SettingsDrawer } from "../components/SettingsDrawer";
import { useAuth } from "../auth/AuthProvider";
import { getDisplayName } from "../auth/userDisplay";
import { getLastViewedDeck } from "../lib/deckPreferences";
import styles from "./AppShell.module.css";

export function AppShell() {
  const { user } = useAuth();
  const name = getDisplayName(user);
  const location = useLocation();
  const [searchOpen, setSearchOpen] = useState(false);
  const [myOpen, setMyOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const isPlay = location.pathname.startsWith("/play");
  const [playNavHidden, setPlayNavHidden] = useState(
    () => localStorage.getItem("deckapp.playHideNav") === "1"
  );
  const [lastDeck, setLastDeck] = useState(() => getLastViewedDeck());
  const searchRef = useRef<HTMLDivElement>(null);
  const myRef = useRef<HTMLDivElement>(null);
  const communityRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSearchOpen(false);
    setMyOpen(false);
    setCommunityOpen(false);
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

  const searchMode = location.pathname.startsWith("/search/simple")
    ? "simple"
    : location.pathname.startsWith("/search") &&
      new URLSearchParams(location.search).get("mode") === "advanced"
      ? "advanced"
      : location.pathname.startsWith("/search")
        ? "standard"
        : null;
  const searchLabel =
    searchMode === "advanced"
      ? "Advanced"
      : searchMode === "simple"
        ? "Simple"
        : searchMode === "standard"
          ? "Standard"
          : "Search";

  useEffect(() => {
    if (!searchOpen && !myOpen && !communityOpen) return;

    let remove: (() => void) | undefined;

    const timer = window.setTimeout(() => {
      function onPointerDown(e: MouseEvent) {
        const t = e.target as Node;
        if (!searchRef.current?.contains(t)) setSearchOpen(false);
        if (!myRef.current?.contains(t)) setMyOpen(false);
        if (!communityRef.current?.contains(t)) setCommunityOpen(false);
      }

      function onKey(e: KeyboardEvent) {
        if (e.key === "Escape") {
          setSearchOpen(false);
          setMyOpen(false);
          setCommunityOpen(false);
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
  }, [searchOpen, myOpen, communityOpen]);

  return (
    <div className={styles.shell}>
      <AmbientBackdrop />
      <div className={styles.headerWrap}>
      <header className={styles.header}>
        <NavLink to="/" className={styles.brand} end>
          Deck<span className={styles.brandAccent}>App</span>
        </NavLink>
        <nav className={styles.nav} aria-label="Main">
          {/* SEARCH dropdown */}
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
                setMyOpen(false);
                setCommunityOpen(false);
              }}
            >
              {searchLabel}
              <span className={`${styles.chevron} ${searchOpen ? styles.chevronOpen : ""}`} aria-hidden>▾</span>
            </button>
            {searchOpen && (
              <div className={styles.decksDropdown} role="menu" onMouseDown={(e) => e.stopPropagation()}>
                <NavLink to="/search?mode=standard" role="menuitem" className={styles.decksItem} onClick={() => setSearchOpen(false)}>Standard</NavLink>
                <NavLink to="/search/simple" role="menuitem" className={styles.decksItem} onClick={() => setSearchOpen(false)}>Simple</NavLink>
                <NavLink to="/search?mode=advanced" role="menuitem" className={styles.decksItem} onClick={() => setSearchOpen(false)}>Advanced</NavLink>
              </div>
            )}
          </div>

          {/* MY dropdown */}
          {user && (
            <div className={styles.decksMenu} ref={myRef}>
              <button
                type="button"
                className={`${styles.navLink} ${styles.decksTrigger} ${
                  myOpen || location.pathname.startsWith("/my-decks") || location.pathname.startsWith("/drawers") || location.pathname.startsWith("/collections") || location.pathname.startsWith("/combos")
                    ? styles.navLinkActive
                    : ""
                }`}
                aria-haspopup="menu"
                aria-expanded={myOpen}
                onClick={(e) => {
                  e.stopPropagation();
                  setMyOpen((v) => !v);
                  setSearchOpen(false);
                  setCommunityOpen(false);
                }}
              >
                My
                <span className={`${styles.chevron} ${myOpen ? styles.chevronOpen : ""}`} aria-hidden>▾</span>
              </button>
              {myOpen && (
                <div className={styles.decksDropdown} role="menu" onMouseDown={(e) => e.stopPropagation()}>
                  <div className={styles.nestedMenu}>
                    <NavLink to="/my-decks" role="menuitem" className={styles.decksItem} onClick={() => setMyOpen(false)}>
                      Decks
                      <span className={styles.chevron} aria-hidden>▸</span>
                    </NavLink>
                    {lastDeck && (
                      <NavLink to={`/deck/${lastDeck.id}`} role="menuitem" className={`${styles.decksItem} ${styles.nestedItem}`} onClick={() => setMyOpen(false)} title={lastDeck.name}>
                        <span className={styles.decksItemLabel}>Last opened</span>
                        <span className={styles.decksItemSub}>{lastDeck.name}</span>
                      </NavLink>
                    )}
                  </div>
                  <NavLink to="/drawers" role="menuitem" className={styles.decksItem} onClick={() => setMyOpen(false)}>Drawers</NavLink>
                  <NavLink to="/collections" role="menuitem" className={styles.decksItem} onClick={() => setMyOpen(false)}>Collections</NavLink>
                  <NavLink to="/combos" role="menuitem" className={styles.decksItem} onClick={() => setMyOpen(false)}>Combos</NavLink>
                </div>
              )}
            </div>
          )}

          {/* Community dropdown */}
          <div className={styles.decksMenu} ref={communityRef}>
            <button
              type="button"
              className={`${styles.navLink} ${styles.decksTrigger} ${
                communityOpen || location.pathname.startsWith("/social") || location.pathname.startsWith("/decks") || location.pathname.startsWith("/formats")
                  ? styles.navLinkActive
                  : ""
              }`}
              aria-haspopup="menu"
              aria-expanded={communityOpen}
              onClick={(e) => {
                e.stopPropagation();
                setCommunityOpen((v) => !v);
                setSearchOpen(false);
                setMyOpen(false);
              }}
            >
              Community
              <span className={`${styles.chevron} ${communityOpen ? styles.chevronOpen : ""}`} aria-hidden>▾</span>
            </button>
            {communityOpen && (
              <div className={styles.decksDropdown} role="menu" onMouseDown={(e) => e.stopPropagation()}>
                <NavLink to="/social" role="menuitem" className={styles.decksItem} onClick={() => setCommunityOpen(false)}>Social</NavLink>
                <NavLink to="/decks" role="menuitem" className={styles.decksItem} onClick={() => setCommunityOpen(false)}>Public deck library</NavLink>
                <NavLink to="/formats" role="menuitem" className={styles.decksItem} onClick={() => setCommunityOpen(false)}>Formats</NavLink>
              </div>
            )}
          </div>

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
          <SettingsButton onClick={() => setSettingsOpen(true)} />
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
      <SettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}
