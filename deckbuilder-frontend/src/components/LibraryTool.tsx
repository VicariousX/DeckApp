import { createPortal } from "react-dom";
import { useMemo, useState } from "react";
import { useDraggablePanel } from "../hooks/useDraggablePanel";
import { useIsMobile } from "../hooks/useIsMobile";
import { BottomSheet } from "./BottomSheet";
import { DrawerPanel } from "./DrawerPanel";
import { namesFromTtsJson } from "../lib/cards/ttsDeck";
import { mergeParsedEntries, parseCardList } from "../lib/cards/parseCardList";
import {
  copyTextToClipboard,
  downloadTextFile,
  exportFilename,
  formatTextExport,
} from "../lib/cards/exportCardList";
import { buildTtsSavedObject } from "../lib/cards/ttsDeck";
import { fetchCardsByNames } from "../lib/scryfallApi";
import { apiUrl } from "../lib/apiBase";
import type { BulkResolvedEntry } from "./BulkCardImport";
import type { DeckCard } from "../types/deck";
import type { DeckToken } from "../lib/deck/deckTokens";
import type { DrawerCardView } from "../types/drawer";
import type { ExportSection } from "../lib/cards/exportCardList";
import styles from "./LibraryTool.module.css";

type Tab = "import" | "export" | "drawers";

type Props = {
  isOwner: boolean;
  deckName: string;
  cards: DeckCard[];
  deckTokens: DeckToken[];
  commanderColorIdentity: string[];
  deckQtyByOracle: Record<string, number>;
  exportSections: ExportSection[];
  onBulkImport: (entries: BulkResolvedEntry[]) => void;
  onAddFromDrawer: (c: DrawerCardView) => void;
  onAdjustFromDrawer: (c: DrawerCardView, d: number) => void;
  onApplyDrawer: (cards: DrawerCardView[]) => void;
};

export function LibraryTool(props: Props) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("import");
  const { panelRef, panelStyle, onHandlePointerDown, onResizePointerDown } = useDraggablePanel(
    open && !isMobile,
    { w: 480, h: 640 }
  );

  const tabs: [Tab, string][] = props.isOwner
    ? [["import", "Import"], ["export", "Export"], ["drawers", "Drawers"]]
    : [["import", "Import"], ["export", "Export"]];

  const body = (
    <div className={styles.shell}>
      <div className={styles.tabs} role="tablist">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={tab === id ? styles.tabOn : styles.tab}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className={styles.pane}>
        {tab === "import" && <ImportPane onImport={props.onBulkImport} />}
        {tab === "export" && (
          <ExportPane
            deckName={props.deckName}
            cards={props.cards}
            deckTokens={props.deckTokens}
            exportSections={props.exportSections}
          />
        )}
        {tab === "drawers" && props.isOwner && (
          <DrawerPanel
            embedded
            onAddCard={props.onAddFromDrawer}
            onAdjustCard={props.onAdjustFromDrawer}
            onApplyDrawer={props.onApplyDrawer}
            commanderColorIdentity={props.commanderColorIdentity}
            applyBoardLabel="Mainboard"
            deckQtyByOracle={props.deckQtyByOracle}
          />
        )}
      </div>
    </div>
  );

  return (
    <>
      <button type="button" className={styles.trigger} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        Bulk tools
      </button>
      {open && isMobile && (
        <BottomSheet open onClose={() => setOpen(false)} title="Bulk tools">
          {body}
        </BottomSheet>
      )}
      {open && !isMobile &&
        createPortal(
          <div className={styles.panel} ref={panelRef} style={panelStyle}>
            <div className={styles.head} onPointerDown={onHandlePointerDown}>
              <span>Bulk tools</span>
              <button type="button" className={styles.close} data-no-drag aria-label="Close" onClick={() => setOpen(false)}>
                ×
              </button>
            </div>
            {body}
            <div className={`${styles.resize} ${styles.resizeE}`} data-no-drag onPointerDown={onResizePointerDown("e")} />
            <div className={`${styles.resize} ${styles.resizeS}`} data-no-drag onPointerDown={onResizePointerDown("s")} />
            <div className={`${styles.resize} ${styles.resizeSe}`} data-no-drag onPointerDown={onResizePointerDown("se")} />
          </div>,
          document.body
        )}
    </>
  );
}

function ImportPane({ onImport }: { onImport: (entries: BulkResolvedEntry[]) => void }) {
  const [text, setText] = useState("");
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [missing, setMissing] = useState<string[]>([]);
  const [preview, setPreview] = useState<BulkResolvedEntry[] | null>(null);
  const parsed = useMemo(() => mergeParsedEntries(parseCardList(text).entries), [text]);

  async function fetchLink() {
    const url = link.trim();
    if (!url) return;
    setBusy(true);
    setError(null);
    setNote("Fetching deck…");
    try {
      const res = await fetch(apiUrl(`/api/import/deck?url=${encodeURIComponent(url)}`));
      const data = (await res.json()) as {
        error?: string;
        name?: string;
        cards?: { name: string; quantity: number; board: string }[];
      };
      if (!res.ok || !data.cards) {
        setError(data.error || "Could not read that link.");
        setNote(null);
        return;
      }
      const blocks: Record<string, string[]> = { commander: [], main: [], side: [], maybe: [] };
      for (const card of data.cards) {
        const board = blocks[card.board] ? card.board : "main";
        blocks[board].push(`${card.quantity} ${card.name}`);
      }
      const textBlocks = [
        blocks.commander.length ? `Commander\n${blocks.commander.join("\n")}` : "",
        blocks.main.length ? `Deck\n${blocks.main.join("\n")}` : "",
        blocks.side.length ? `Sideboard\n${blocks.side.join("\n")}` : "",
        blocks.maybe.length ? `Maybeboard\n${blocks.maybe.join("\n")}` : "",
      ].filter(Boolean);
      setText(textBlocks.join("\n\n"));
      setPreview(null);
      setNote(data.name ? `Loaded ${data.name}` : "List loaded");
    } catch {
      setError("Could not reach the import service.");
      setNote(null);
    } finally {
      setBusy(false);
    }
  }

  async function resolve() {
    if (!parsed.length) {
      setError("No card lines found.");
      return;
    }
    setBusy(true);
    setError(null);
    setNote(`Looking up ${parsed.length} names…`);
    const { byName, notFound, error: err } = await fetchCardsByNames(parsed.map((e) => e.name));
    setBusy(false);
    if (err && byName.size === 0) {
      setError(err);
      setNote(null);
      return;
    }
    const resolved: BulkResolvedEntry[] = [];
    const absent = [...notFound];
    for (const entry of parsed) {
      const card = byName.get(entry.name.toLowerCase());
      if (!card) {
        if (!absent.includes(entry.name)) absent.push(entry.name);
        continue;
      }
      resolved.push({ name: card.name, quantity: entry.quantity, card, board: entry.board });
    }
    setMissing(absent);
    setPreview(resolved);
    setNote(null);
    if (!resolved.length) setError("None of those names matched.");
  }

  async function confirm() {
    if (!preview?.length) return;
    setBusy(true);
    try {
      await onImport(preview);
      setText("");
      setPreview(null);
      setMissing([]);
      setNote("Imported.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.form}>
      <p className={styles.hint}>
        Paste a list or a public deck link. Double-faced cards can be <em>Fire // Ice</em> or a following <em>// Ice</em> line. Commander and sideboard headers are kept.
      </p>
      <div className={styles.row}>
        <input className={styles.control} value={link} placeholder="Archidekt, Moxfield, or Deckstats link" onChange={(e) => setLink(e.target.value)} />
        <button type="button" className={styles.btn} disabled={busy || !link.trim()} onClick={() => void fetchLink()}>Fetch</button>
      </div>
      <label className={styles.file}>
        TTS JSON
        <input
          type="file"
          accept="application/json,.json"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const lines = namesFromTtsJson(await file.text()).map((c) => `${c.quantity} ${c.name}`);
            setText(lines.join("\n"));
            setPreview(null);
            e.target.value = "";
          }}
        />
      </label>
      <textarea
        className={styles.area}
        value={text}
        rows={8}
        placeholder={"1 Sol Ring\n1 Fire // Ice\nCommander\n1 Atraxa, Praetors' Voice"}
        onChange={(e) => {
          setText(e.target.value);
          setPreview(null);
        }}
      />
      <p className={styles.meta}>{parsed.length} names · {parsed.reduce((n, e) => n + e.quantity, 0)} copies</p>
      {error && <p className={styles.error}>{error}</p>}
      {note && <p className={styles.meta}>{note}</p>}
      {preview && (
        <ul className={styles.list}>
          {preview.slice(0, 8).map((e) => (
            <li key={`${e.board}-${e.card.id}`}>{e.quantity}× {e.name}{e.board && e.board !== "main" ? ` · ${e.board}` : ""}</li>
          ))}
          {preview.length > 8 && <li>+{preview.length - 8} more</li>}
          {missing.length > 0 && <li className={styles.error}>Not found: {missing.slice(0, 4).join(", ")}</li>}
        </ul>
      )}
      <div className={styles.actions}>
        {!preview ? (
          <button type="button" className={styles.primary} disabled={busy || !parsed.length} onClick={() => void resolve()}>
            {busy ? "Looking up…" : "Preview"}
          </button>
        ) : (
          <>
            <button type="button" className={styles.btn} disabled={busy} onClick={() => setPreview(null)}>Back</button>
            <button type="button" className={styles.primary} disabled={busy || !preview.length} onClick={() => void confirm()}>
              {busy ? "Importing…" : `Import ${preview.length}`}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function ExportPane({
  deckName,
  cards,
  deckTokens,
  exportSections,
}: {
  deckName: string;
  cards: DeckCard[];
  deckTokens: DeckToken[];
  exportSections: ExportSection[];
}) {
  const [tokens, setTokens] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const extra = deckTokens.some((t) => t.included)
    ? [{
        title: "Tokens",
        items: deckTokens.filter((t) => t.included).map((t) => ({ name: t.name, quantity: t.quantity || 1 })),
      }]
    : [];
  const sections = tokens ? [...exportSections, ...extra] : exportSections;
  const text = useMemo(() => formatTextExport(sections), [sections]);
  const total = sections.reduce((n, s) => n + s.items.reduce((m, i) => m + (i.quantity ?? 1), 0), 0);
  const ttsParts = [
    {
      name: `${deckName} main`,
      cards: cards.filter((c) => c.board === "main" || c.board === "commander").map((c) => ({
        name: c.name,
        scryfallId: c.scryfall_id,
        quantity: c.quantity,
      })),
    },
    {
      name: `${deckName} side`,
      cards: cards.filter((c) => c.board === "side").map((c) => ({
        name: c.name,
        scryfallId: c.scryfall_id,
        quantity: c.quantity,
      })),
    },
  ];

  return (
    <div className={styles.form}>
      <p className={styles.hint}>
        {total} cards. Double-faced names are written as <em>Fire // Ice</em> so the list imports cleanly.
      </p>
      {extra.length > 0 && (
        <label className={styles.check}>
          <input type="checkbox" checked={tokens} onChange={(e) => setTokens(e.target.checked)} />
          Include tokens
        </label>
      )}
      <pre className={styles.preview}>{text || "Nothing to export."}</pre>
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.primary}
          disabled={!text}
          onClick={() => void copyTextToClipboard(text).then((ok) => setStatus(ok ? "Copied" : "Copy failed"))}
        >
          Copy
        </button>
        <button type="button" className={styles.btn} disabled={!text} onClick={() => downloadTextFile(exportFilename(deckName), text)}>
          Download .txt
        </button>
        <button
          type="button"
          className={styles.btn}
          onClick={() => downloadTextFile(`${deckName.replace(/\s+/g, "-")}-tts.json`, buildTtsSavedObject(deckName, ttsParts))}
        >
          TTS object
        </button>
      </div>
      {status && <p className={styles.meta}>{status}</p>}
    </div>
  );
}
