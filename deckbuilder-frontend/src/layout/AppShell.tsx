import { useEffect, useRef, useState, type ReactNode } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { AmbientBackdrop } from "../components/AmbientBackdrop";
import { SettingsButton, SettingsDrawer } from "../components/SettingsDrawer";
import { RouteStage } from "./RouteStage";
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
  const [communityOpen, setCommunityOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const isPlay = location.pathname.startsWith("/play");
  const [playNavHidden, setPlayNavHidden] = useState(
    () => localStorage.getItem("deckapp.playHideNav") === "1"
  );
  const [lastDeck, setLastDeck] = useState(() => getLastViewedDeck());
  const searchRef = useRef<HTMLDivElement>(null);
  const myRef = useRef<HTMLDivElement>(null);
  const communityRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

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
        if (
          !searchRef.current?.contains(t) &&
          !sheetRef.current?.contains(t)
        ) setSearchOpen(false);
        if (!myRef.current?.contains(t) && !sheetRef.current?.contains(t)) setMyOpen(false);
        if (
          !communityRef.current?.contains(t) &&
          !sheetRef.current?.contains(t)
        ) setCommunityOpen(false);
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

  const myActive =
    location.pathname.startsWith("/my-decks") ||
    location.pathname.startsWith("/deck/") ||
    location.pathname.startsWith("/drawers") ||
    location.pathname.startsWith("/collections") ||
    location.pathname.startsWith("/combos");
  const communityActive =
    location.pathname.startsWith("/social") ||
    location.pathname.startsWith("/decks") ||
    location.pathname.startsWith("/formats");
  const homeActive = location.pathname === "/";
  const youActive = location.pathname.startsWith("/login");

  function closeSheets() {
    setSearchOpen(false);
    setMyOpen(false);
    setCommunityOpen(false);
  }

  return (
    <div className={`${styles.shell}${isPlay ? "" : ` ${styles.shellWithTabs}`}`}>
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
                <NavLink to="/search/simple" role="menuitem" className={styles.decksItem} onClick={() => setSearchOpen(false)}>Simple</NavLink>
                <NavLink to="/search?mode=standard" role="menuitem" className={styles.decksItem} onClick={() => setSearchOpen(false)}>Standard</NavLink>
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
        <span className={styles.mobileSettings}>
          <SettingsButton onClick={() => setSettingsOpen(true)} />
        </span>
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
        <RouteStage>
          <Outlet />
        </RouteStage>
      </main>
      {!isPlay && (
        <div className={styles.mobileNav} ref={sheetRef}>
          {(searchOpen || myOpen || communityOpen) && (
            <div className={styles.tabSheet} role="menu">
              {searchOpen && (
                <>
                  <NavLink to="/search/simple" role="menuitem" className={styles.decksItem} onClick={closeSheets}>Simple</NavLink>
                  <NavLink to="/search?mode=standard" role="menuitem" className={styles.decksItem} onClick={closeSheets}>Standard</NavLink>
                  <NavLink to="/search?mode=advanced" role="menuitem" className={styles.decksItem} onClick={closeSheets}>Advanced</NavLink>
                </>
              )}
              {myOpen && (
                <>
                  <NavLink to="/my-decks" role="menuitem" className={styles.decksItem} onClick={closeSheets}>Decks</NavLink>
                  {lastDeck && (
                    <NavLink to={`/deck/${lastDeck.id}`} role="menuitem" className={styles.decksItem} onClick={closeSheets}>
                      Last opened · {lastDeck.name}
                    </NavLink>
                  )}
                  <NavLink to="/drawers" role="menuitem" className={styles.decksItem} onClick={closeSheets}>Drawers</NavLink>
                  <NavLink to="/collections" role="menuitem" className={styles.decksItem} onClick={closeSheets}>Collections</NavLink>
                  <NavLink to="/combos" role="menuitem" className={styles.decksItem} onClick={closeSheets}>Combos</NavLink>
                </>
              )}
              {communityOpen && (
                <>
                  <NavLink to="/social" role="menuitem" className={styles.decksItem} onClick={closeSheets}>Social</NavLink>
                  <NavLink to="/decks" role="menuitem" className={styles.decksItem} onClick={closeSheets}>Public deck library</NavLink>
                  <NavLink to="/formats" role="menuitem" className={styles.decksItem} onClick={closeSheets}>Formats</NavLink>
                </>
              )}
            </div>
          )}
          <nav className={styles.tabBar} aria-label="Mobile">
            <NavLink
              to="/"
              end
              className={`${styles.tabItem} ${homeActive ? styles.tabItemOn : ""}`}
              onClick={closeSheets}
            >
              <TabIcon>
                <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z" />
              </TabIcon>
              Home
            </NavLink>
            <button
              type="button"
              className={`${styles.tabItem} ${searchMode || searchOpen ? styles.tabItemOn : ""}`}
              aria-expanded={searchOpen}
              onClick={() => {
                setSearchOpen((v) => !v);
                setMyOpen(false);
                setCommunityOpen(false);
              }}
            >
              <TabIcon>
                <circle cx="11" cy="11" r="6" />
                <path d="m20 20-3.5-3.5" />
              </TabIcon>
              Search
            </button>
            {user && (
              <button
                type="button"
                className={`${styles.tabItem} ${myActive || myOpen ? styles.tabItemOn : ""}`}
                aria-expanded={myOpen}
                onClick={() => {
                  setMyOpen((v) => !v);
                  setSearchOpen(false);
                  setCommunityOpen(false);
                }}
              >
                <TabIcon>
                  <path d="m12 3-9 5 9 5 9-5-9-5z" />
                  <path d="m3 12 9 5 9-5" />
                  <path d="m3 16 9 5 9-5" />
                </TabIcon>
                My
              </button>
            )}
            <button
              type="button"
              className={`${styles.tabItem} ${communityActive || communityOpen ? styles.tabItemOn : ""}`}
              aria-expanded={communityOpen}
              onClick={() => {
                setCommunityOpen((v) => !v);
                setSearchOpen(false);
                setMyOpen(false);
              }}
            >
              <TabIcon>
                <path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="3" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a3 3 0 0 1 0 5.75" />
              </TabIcon>
              Community
            </button>
            <NavLink
              to="/login"
              className={`${styles.tabItem} ${youActive ? styles.tabItemOn : ""}`}
              onClick={closeSheets}
            >
              <TabIcon>
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </TabIcon>
              {user ? "You" : "Log in"}
            </NavLink>
          </nav>
        </div>
      )}
    </div>
  );
}

function TabIcon({ children }: { children: ReactNode }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {children}
    </svg>
  );
}
