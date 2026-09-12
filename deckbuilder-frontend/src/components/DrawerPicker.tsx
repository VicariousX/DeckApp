import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import {
  createDrawer,
  drawersContainingOracle,
  listDrawers,
  seedDefaultDrawers,
  toggleDrawerMembershipByOracle,
  toggleDrawerMembershipFromScryfall,
} from "../services/drawerService";
import type { Drawer } from "../types/drawer";
import type { ScryfallCard } from "../types/scryfallCard";
import styles from "./DrawerPicker.module.css";

type Props = {
  oracleId: string;
  /** When provided, toggling will ensure user_cards from this Scryfall payload. */
  scryfallCard?: ScryfallCard | null;
  className?: string;
};

export function DrawerPicker({ oracleId, scryfallCard, className }: Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [drawers, setDrawers] = useState<Drawer[]>([]);
  const [memberIds, setMemberIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const reload = useCallback(async () => {
    if (!user) return;
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
    const { drawerIds, error: mErr } = await drawersContainingOracle(
      user.id,
      oracleId
    );
    if (mErr) {
      setError(mErr);
      setLoading(false);
      return;
    }
    setMemberIds(new Set(drawerIds));
    setLoading(false);
  }, [user, oracleId]);

  useEffect(() => {
    if (open) void reload();
  }, [open, reload]);

  async function onToggle(drawer: Drawer) {
    if (!user) return;
    const inDrawer = memberIds.has(drawer.id);
    // Optimistic
    setMemberIds((prev) => {
      const next = new Set(prev);
      if (inDrawer) next.delete(drawer.id);
      else next.add(drawer.id);
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
      void reload();
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
          {memberIds.size > 0 ? memberIds.size : "·"}
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

          {loading && <p className={styles.muted}>Loading…</p>}
          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}

          {!loading && (
            <ul className={styles.list}>
              {drawers.map((d) => {
                const on = memberIds.has(d.id);
                return (
                  <li key={d.id}>
                    <button
                      type="button"
                      className={`${styles.item}${on ? ` ${styles.itemOn}` : ""}`}
                      onClick={() => void onToggle(d)}
                      role="option"
                      aria-selected={on}
                    >
                      <span className={styles.check}>{on ? "✓" : ""}</span>
                      <span className={styles.itemName}>{d.name}</span>
                      <span className={styles.itemCount}>
                        {d.card_count ?? ""}
                      </span>
                    </button>
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
        </div>
      )}
    </div>
  );
}
