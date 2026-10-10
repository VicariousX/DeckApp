import { BUILTIN_FORMATS, type DynamicRule, type HouseFormat } from "../lib/formats/rules";
import styles from "../pages/FormatsPage.module.css";

const RULE_LABELS: Record<DynamicRule["kind"], string> = {
  copyException: "Copy exception",
  maxEdhrec: "Max EDHREC rank",
  maxCardPrice: "Max card price",
  maxDeckPrice: "Max deck price",
  minCmc: "Min mana value",
  maxCmc: "Max mana value",
};

export function HouseFormatEditor({
  draft,
  setDraft,
  onSave,
  saveLabel,
}: {
  draft: HouseFormat;
  setDraft: (next: HouseFormat) => void;
  onSave: () => void;
  saveLabel: string;
}) {
  function applyBase(id: string) {
    const base = BUILTIN_FORMATS.find((f) => f.id === id);
    if (!base) return setDraft({ ...draft, basedOn: "" });
    setDraft({
      ...draft,
      basedOn: base.id,
      deckSize: base.deckSize,
      sideboardSize: base.sideboardSize,
      copyLimit: base.copyLimit || 1,
      singleton: base.singleton,
      commanderRequired: base.commanderRequired,
      colorIdentity: base.colorIdentity,
      legalityKey: base.legalityKey,
    });
  }

  return (
    <form
      className={styles.form}
      onSubmit={(e) => {
        e.preventDefault();
        onSave();
      }}
    >
      <div className={styles.grid}>
        <label className={styles.field}>
          <span>Name</span>
          <input className={styles.input} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} required />
        </label>
        <label className={styles.field}>
          <span>Based on</span>
          <select className={styles.input} value={draft.basedOn} onChange={(e) => applyBase(e.target.value)}>
            <option value="">None</option>
            {BUILTIN_FORMATS.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          <span>Deck size</span>
          <input
            className={styles.input}
            type="number"
            min={0}
            value={draft.deckSize ?? ""}
            onChange={(e) => setDraft({ ...draft, deckSize: e.target.value ? Number(e.target.value) : null })}
          />
        </label>
        <label className={styles.field}>
          <span>Copy limit</span>
          <input
            className={styles.input}
            type="number"
            min={1}
            value={draft.copyLimit}
            onChange={(e) => setDraft({ ...draft, copyLimit: Number(e.target.value) || 1 })}
          />
        </label>
      </div>
      <div className={styles.toggles}>
        <label className={styles.toggle}>
          <input type="checkbox" checked={draft.singleton} onChange={(e) => setDraft({ ...draft, singleton: e.target.checked })} />
          <span>Singleton</span>
        </label>
        <label className={styles.toggle}>
          <input type="checkbox" checked={draft.commanderRequired} onChange={(e) => setDraft({ ...draft, commanderRequired: e.target.checked })} />
          <span>Commander required</span>
        </label>
        <label className={styles.toggle}>
          <input type="checkbox" checked={draft.colorIdentity} onChange={(e) => setDraft({ ...draft, colorIdentity: e.target.checked })} />
          <span>Color identity</span>
        </label>
      </div>
      <label className={styles.field}>
        <span>Whitelist — unban these cards</span>
        <textarea
          className={styles.textarea}
          value={(draft.whitelist ?? []).join("\n")}
          onChange={(e) => setDraft({ ...draft, whitelist: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })}
        />
      </label>
      <label className={styles.field}>
        <span>Blacklist — ban these cards</span>
        <textarea
          className={styles.textarea}
          value={draft.banned.join("\n")}
          onChange={(e) => setDraft({ ...draft, banned: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })}
        />
      </label>
      <div className={styles.field}>
        <span>Dynamic rules</span>
        {(draft.rules ?? []).map((row, i) => (
          <div key={i} className={styles.grid}>
            <select
              className={styles.input}
              value={row.kind}
              onChange={(e) => {
                const rules = [...draft.rules];
                rules[i] = { ...row, kind: e.target.value as DynamicRule["kind"] };
                setDraft({ ...draft, rules });
              }}
            >
              {Object.entries(RULE_LABELS).map(([id, label]) => (
                <option key={id} value={id}>{label}</option>
              ))}
            </select>
            {row.kind === "copyException" && (
              <input
                className={styles.input}
                value={row.target ?? ""}
                placeholder="Card name or type"
                onChange={(e) => {
                  const rules = [...draft.rules];
                  rules[i] = { ...row, target: e.target.value };
                  setDraft({ ...draft, rules });
                }}
              />
            )}
            <input
              className={styles.input}
              type="number"
              min={0}
              value={row.value}
              placeholder={row.kind === "copyException" ? "Copies" : "Value"}
              onChange={(e) => {
                const rules = [...draft.rules];
                rules[i] = { ...row, value: Number(e.target.value) || 0 };
                setDraft({ ...draft, rules });
              }}
            />
            <button
              type="button"
              className={styles.deleteBtn}
              onClick={() => setDraft({ ...draft, rules: draft.rules.filter((_, n) => n !== i) })}
            >
              Remove
            </button>
          </div>
        ))}
        <button type="button" className={styles.deleteBtn} onClick={() => setDraft({ ...draft, rules: [...(draft.rules ?? []), { kind: "copyException", value: 4, target: "" }] })}>
          Add rule
        </button>
      </div>
      <label className={styles.field}>
        <span>Notes</span>
        <textarea className={styles.textarea} value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
      </label>
      <div className={styles.actions}>
        <button className={styles.primaryBtn} type="submit">{saveLabel}</button>
      </div>
    </form>
  );
}
