/**
 * Text export helpers for decks, drawers, and future TTS packaging.
 */

export type ExportLineItem = {
  name: string;
  quantity?: number;
};

export type ExportSection = {
  title: string;
  items: ExportLineItem[];
};

export type TextExportOptions = {
  /** "1x Name" (default) vs "1 Name" */
  quantityStyle?: "x" | "plain";
  /** Include section headers when multiple sections exist */
  includeHeaders?: boolean;
  /** Blank line between sections (default true) */
  blankLineBetweenSections?: boolean;
};

const DEFAULTS: Required<TextExportOptions> = {
  quantityStyle: "x",
  includeHeaders: true,
  blankLineBetweenSections: true,
};

function formatLine(
  item: ExportLineItem,
  style: "x" | "plain"
): string {
  const qty = Math.max(1, item.quantity ?? 1);
  if (qty === 1 && style === "x") return `1x ${item.name}`;
  if (style === "x") return `${qty}x ${item.name}`;
  return `${qty} ${item.name}`;
}

/** Build a plain-text list from sections (e.g. Mainboard / Sideboard). */
export function formatTextExport(
  sections: ExportSection[],
  options?: TextExportOptions
): string {
  const opts = { ...DEFAULTS, ...options };
  const nonEmpty = sections.filter((s) => s.items.length > 0);
  const parts: string[] = [];

  for (let i = 0; i < nonEmpty.length; i++) {
    const section = nonEmpty[i];
    const lines: string[] = [];
    if (opts.includeHeaders && (nonEmpty.length > 1 || section.title)) {
      lines.push(`${section.title}:`);
    }
    // Stable name order within section for readable diffs
    const items = [...section.items].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
    );
    for (const item of items) {
      lines.push(formatLine(item, opts.quantityStyle));
    }
    parts.push(lines.join("\n"));
  }

  const sep = opts.blankLineBetweenSections ? "\n\n" : "\n";
  return parts.join(sep).trim() + (parts.length ? "\n" : "");
}

/** Flatten a simple name list (drawers — no quantities). */
export function formatNameList(
  names: string[],
  options?: TextExportOptions
): string {
  return formatTextExport(
    [
      {
        title: "",
        items: names.map((name) => ({ name, quantity: 1 })),
      },
    ],
    {
      ...options,
      includeHeaders: false,
      quantityStyle: options?.quantityStyle ?? "x",
    }
  );
}

export function downloadTextFile(
  filename: string,
  content: string,
  mime = "text/plain;charset=utf-8"
): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function copyTextToClipboard(content: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(content);
      return true;
    }
  } catch {
    /* fall through */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = content;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

/** Safe filename from deck/drawer name */
export function exportFilename(base: string, ext = "txt"): string {
  const cleaned =
    base
      .trim()
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
      .replace(/\s+/g, " ")
      .slice(0, 80) || "export";
  return `${cleaned}.${ext}`;
}
