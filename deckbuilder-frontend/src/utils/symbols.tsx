import React from "react";

const SCRYFALL_SVG_BASE = "https://svgs.scryfall.io/card-symbols";

/** Special inner codes that don't map 1:1 after stripping braces + slashes */
const SPECIAL_CODES: Record<string, string> = {
  "½": "HALF",
  "∞": "INFINITY",
};

/**
 * Convert a Scryfall symbol string (e.g. "{W}", "{2/W}", "{½}") into the
 * corresponding official SVG URL on Scryfall's CDN.
 */
export function symbolToSvgUri(symbol: string): string {
  const raw = symbol.trim();
  const inner = raw.startsWith("{") && raw.endsWith("}")
    ? raw.slice(1, -1)
    : raw;

  if (SPECIAL_CODES[inner]) {
    return `${SCRYFALL_SVG_BASE}/${SPECIAL_CODES[inner]}.svg`;
  }

  // Hybrids / Phyrexian / etc. drop the slash: {W/U} → WU, {2/W} → 2W, {W/P} → WP
  const code = inner.replace(/\//g, "").toUpperCase();
  return `${SCRYFALL_SVG_BASE}/${code}.svg`;
}

/**
 * Parse a mana cost string into individual symbol tokens.
 * Example: "{2}{W}{U}" → ["{2}", "{W}", "{U}"]
 */
export function parseManaCost(cost: string): string[] {
  if (!cost) return [];
  return cost.match(/\{[^}]+\}/g) ?? [];
}

/**
 * Render a single mana / card symbol as an <img> using Scryfall's SVG.
 */
export function renderManaSymbol(
  symbol: string,
  size: number = 22
): React.ReactNode {
  const uri = symbolToSvgUri(symbol);
  const alt = symbol.replace(/[{}]/g, "");

  return (
    <img
      src={uri}
      alt={alt}
      width={size}
      height={size}
      className="mana-symbol-img"
      loading="lazy"
      draggable={false}
    />
  );
}

/**
 * Split text on Scryfall symbol tokens and return a mixed array of
 * strings + React elements (images). Suitable for oracle text, rules text, etc.
 */
export function renderTextWithSymbols(
  text: string,
  symbolSize: number = 16
): React.ReactNode[] {
  if (!text) return [];

  const parts = text.split(/(\{[^}]+\})/g);

  return parts.map((part, index) => {
    if (part.startsWith("{") && part.endsWith("}")) {
      return (
        <img
          key={`sym-${index}`}
          src={symbolToSvgUri(part)}
          alt={part.replace(/[{}]/g, "")}
          width={symbolSize}
          height={symbolSize}
          className="inline-symbol"
          loading="lazy"
          draggable={false}
        />
      );
    }

    // Preserve newlines for pre-wrap containers
    return (
      <React.Fragment key={`txt-${index}`}>
        {part}
      </React.Fragment>
    );
  });
}
