import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import {
  createDrawer,
  drawersContainingOracle,
  listDrawers,
  seedDefaultDrawers,
  setDrawerCardTier,
  toggleDrawerMembershipByOracle,
  toggleDrawerMembershipFromScryfall,
  type DrawerMembership,
} from "../services/drawerService";
import type { Drawer } from "../types/drawer";
import type { ScryfallCard } from "../types/scryfallCard";
import styles from "./DrawerPicker.module.css";

type Props = {
  oracleId: string;
  scryfallCard?: ScryfallCard | null;
  className?: string;
  /** Render list in-place (no popover) — modal Drawers tab. */
  inline?: boolean;
};

export function DrawerPicker({
  oracleId,
  scryfallCard,
  className,
  inline = false,
}: Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState(inline);
  const [drawers, setDrawers] = useState<Drawer[]>([]);
  const [memberships, setMemberships] = useState<Map<string, DrawerMembership>>(
    () => new Map()
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  // Cache drawer list for the life of this mount (modal open)
  const drawersCached = useRef(false);

  const loadMemberships = useCallback(async () => {
    if (!user) return;
    const { memberships: rows, error: mErr } = await drawersContainingOracle(
      user.id,
      oracleId
    );
    if (mErr) {
      setError(mErr);
      return;
    }
    const map = new Map<string, DrawerMembership>();
    for (const m of rows) map.set(m.drawer_id, m);
    setMemberships(map);
  }, [user, oracleId]);

  const ensureDrawers = useCallback(async () => {
    if (!user) return;
    if (drawersCached.current && drawers.length > 0) {
      await loadMemberships();
      return;
    }
    setLoading(true);
    setError(null);
    let { drawers: list, error: dErr } = await listDrawers(user.id);
    if (dErr) {
      setError(dErr);
      setLoading(false);
      return;
    }
    if (list.length === 0) {
      const seeded = await seedDefaultDrawers(user.id);
      if (seeded.error) {
        setError(seeded.error);
        setLoading(false);
        return;
      }
      list = seeded.drawers;
    }
    setDrawers(list);
    drawersCached.current = true;
    await loadMemberships();
    setLoading(false);
  }, [user, drawers.length, loadMemberships]);

  useEffect(() => {
    if (open || inline) void ensureDrawers();
  }, [open, inline, ensureDrawers]);

  // When oracle changes while open, only refresh memberships (keep drawer list)
  useEffect(() => {
    if ((open || inline) && drawersCached.current) {
      void loadMemberships();
    }
  }, [oracleId, open, inline, loadMemberships]);

  async function onToggle(drawer: Drawer) {
    if (!user) return;
    const current = memberships.get(drawer.id);
    const inDrawer = Boolean(current);
    // Optimistic
    setMemberships((prev) => {
      const next = new Map(prev);
      if (inDrawer) next.delete(drawer.id);
      else
        next.set(drawer.id, {
          drawer_id: drawer.id,
          drawer_card_id: current?.drawer_card_id ?? `tmp-${drawer.id}`,
          tier: 1,
        });
      return next;
    });

    const { error: err } = scryfallCard
      ? await toggleDrawerMembershipFromScryfall(
          user.id,
          drawer.id,
          scryfallCard,
          inDrawer
        )
      : await toggleDrawerMembershipByOracle(drawer.id, oracleId, inDrawer);

    if (err) {
      setError(err);
      void loadMemberships();
      return;
    }
    // Refresh to get real drawer_card ids / tiers
    void loadMemberships();
  }

  async function onTier(drawerId: string, delta: number) {
    const m = memberships.get(drawerId);
    if (!m || m.drawer_card_id.startsWith("tmp-")) return;
    const nextTier = Math.max(1, m.tier + delta);
    setMemberships((prev) => {
      const next = new Map(prev);
      next.set(drawerId, { ...m, tier: nextTier });
      return next;
    });
    const { error: err } = await setDrawerCardTier(m.drawer_card_id, nextTier);
    if (err) {
      setError(err);
      void loadMemberships();
    }
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !newName.trim()) return;
    setCreating(true);
    const { drawer, error: err } = await createDrawer(user.id, newName);
    setCreating(false);
    if (err || !drawer) {
      setError(err ?? "Could not create drawer.");
      return;
    }
    setNewName("");
    setDrawers((prev) => [...prev, { ...drawer, card_count: 0 }]);
  }

  if (!user) return null;

  const body = (
    <>
      {inline && (
        <div className={styles.manageRow}>
          <Link to="/drawers" className={styles.manageLink}>
            Manage drawers →
          </Link>
        </div>
      )}

      {loading && <p className={styles.muted}>Loading…</p>}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      {!loading && (
        <ul className={styles.list} role="listbox" aria-label="Drawers">
          {drawers.map((d) => {
            const m = memberships.get(d.id);
            const on = Boolean(m);
            return (
              <li key={d.id} className={styles.itemRow}>
                <button
                  type="button"
                  className={`${styles.item}${on ? ` ${styles.itemOn}` : ""}`}
                  onClick={() => void onToggle(d)}
                  role="option"
                  aria-selected={on}
                >
                  <span className={styles.check}>{on ? "✓" : ""}</span>
                  <span className={styles.itemName}>{d.name}</span>
                  <span className={styles.itemCount}>{d.card_count ?? ""}</span>
                </button>
                {on && m && (
                  <div className={styles.tierControls} title="Tier (1 = highest)">
                    <button
                      type="button"
                      className={styles.tierBtn}
                      aria-label="Higher tier"
                      onClick={(e) => {
                        e.stopPropagation();
                        void onTier(d.id, -1);
                      }}
                      disabled={m.tier <= 1}
                    >
                      −
                    </button>
                    <span className={styles.tierValue}>T{m.tier}</span>
                    <button
                      type="button"
                      className={styles.tierBtn}
                      aria-label="Lower tier"
                      onClick={(e) => {
                        e.stopPropagation();
                        void onTier(d.id, 1);
                      }}
                    >
                      +
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <form className={styles.createRow} onSubmit={(e) => void onCreate(e)}>
        <input
          className={styles.createInput}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New drawer…"
          maxLength={60}
        />
        <button
          type="submit"
          className={styles.createBtn}
          disabled={creating || !newName.trim()}
        >
          Add
        </button>
      </form>
    </>
  );

  if (inline) {
    return (
      <div className={`${styles.inline}${className ? ` ${className}` : ""}`}>
        {body}
      </div>
    );
  }

  return (
    <div className={`${styles.wrap}${className ? ` ${className}` : ""}`}>
      <button
        type="button"
        className={styles.trigger}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((v) => !v)}
      >
        Drawers
        <span className={styles.badge} aria-hidden>
          {memberships.size > 0 ? memberships.size : "·"}
        </span>
      </button>

      {open && (
        <div className={styles.popover} role="listbox" aria-label="Drawers">
          <div className={styles.popoverHeader}>
            <span>Add to drawer</span>
            <button
              type="button"
              className={styles.closeBtn}
              onClick={() => setOpen(false)}
              aria-label="Close"
            >
              ×
            </button>
          </div>
          {body}
        </div>
      )}
    </div>
  );
}
