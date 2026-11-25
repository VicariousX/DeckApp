import { useSyncExternalStore } from "react";
import { PillSwitch } from "./PillSwitch";
import { CardSizeSlider } from "./CardSizeSlider";
import { getSearchPageControls, subscribeSearchPageControls } from "../lib/searchPageControls";
import styles from "./ToolsMenu.module.css";

export function SearchPageSettings() {
  const controls = useSyncExternalStore(subscribeSearchPageControls, getSearchPageControls, getSearchPageControls);
  if (!controls) return null;
  const targets = [...controls.targets].sort((a, b) => {
    const ak = `${a.kind}:${a.id}`;
    const bk = `${b.kind}:${b.id}`;
    const ap = controls.pinned.includes(ak) ? 0 : 1;
    const bp = controls.pinned.includes(bk) ? 0 : 1;
    return ap - bp || a.name.localeCompare(b.name);
  });

  return (
    <div className={styles.stack}>
      <div className={styles.menuSection}>
        <div className={styles.menuHeading}>View</div>
        <div className={styles.seg} role="group" aria-label="Result view">
          {(["text", "catalog", "scroll"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              className={controls.browseMode === mode ? styles.segOn : undefined}
              aria-pressed={controls.browseMode === mode}
              onClick={() => controls.setBrowseMode(mode)}
            >
              {mode === "text" ? "Text" : mode === "catalog" ? "Catalog" : "Scroll"}
            </button>
          ))}
        </div>
      </div>
      <div className={styles.menuSection}>
        <div className={styles.menuHeading}>Sort</div>
        <select
          className={styles.select}
          value={controls.sortKey}
          aria-label="Sort"
          onChange={(e) => controls.setSort(e.target.value)}
        >
          {controls.sortOptions.map((o) => (
            <option key={o.key} value={o.key}>{o.label}</option>
          ))}
        </select>
        <div className={styles.seg}>
          <button type="button" onClick={controls.toggleDir}>
            {controls.sortDir === "desc" ? "Z → A" : "A → Z"}
          </button>
          {controls.pageSizes.map((n) => (
            <button
              key={n}
              type="button"
              className={controls.pageSize === n ? styles.segOn : undefined}
              aria-pressed={controls.pageSize === n}
              onClick={() => controls.setPageSize(n)}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
      <div className={styles.menuSection}>
        <div className={styles.menuHeading}>Target group</div>
        {targets.length === 0 ? (
          <p className={styles.hint}>No targetable groups. Enable one from Drawers, Collections, or a deck.</p>
        ) : (
          <>
            <select
              className={styles.select}
              value={controls.targetKey}
              aria-label="Search target group"
              onChange={(e) => controls.setTarget(e.target.value)}
            >
              <option value="">None</option>
              {targets.map((t) => {
                const key = `${t.kind}:${t.id}`;
                return (
                  <option key={key} value={key}>
                    {controls.pinned.includes(key) ? "★ " : ""}{t.kind} · {t.name}
                  </option>
                );
              })}
            </select>
            {controls.targetKey && (
              <button type="button" className={styles.linkBtn} onClick={() => controls.togglePin(controls.targetKey)}>
                {controls.pinned.includes(controls.targetKey) ? "Unpin this target" : "Pin this target"}
              </button>
            )}
          </>
        )}
      </div>
      <div className={styles.menuSection}>
        <PillSwitch
          checked={controls.showTargetChip}
          onChange={controls.setShowTargetChip}
          label="Show target indicator"
        />
      </div>
      <div className={styles.menuSection}>
        <div className={styles.menuHeading}>Cards</div>
        <CardSizeSlider sizeKey="search" />
      </div>
    </div>
  );
}
