/**
 * Download all Scryfall card-symbol SVGs into public/symbols/
 *
 * Usage:
 *   node scripts/download-symbols.mjs
 *   npm run download:symbols
 */

import { mkdir, writeFile, readdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "../public/symbols");
const SYMBOLOGY_URL = "https://api.scryfall.com/symbology";
const USER_AGENT = "DeckBuilderApp/1.0 (local development; symbol download)";

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  console.log("Fetching symbology from Scryfall…");
  const res = await fetch(SYMBOLOGY_URL, {
    headers: { "User-Agent": USER_AGENT },
  });

  if (!res.ok) {
    throw new Error(`Symbology request failed: ${res.status} ${res.statusText}`);
  }

  const json = await res.json();
  const symbols = json.data ?? [];

  console.log(`Found ${symbols.length} symbols. Downloading SVGs…\n`);

  let ok = 0;
  let failed = 0;

  for (const entry of symbols) {
    const svgUri = entry.svg_uri;
    if (!svgUri) {
      console.warn(`  skip ${entry.symbol} (no svg_uri)`);
      continue;
    }

    // Filename is the last path segment, e.g. "WU.svg", "HALF.svg"
    const filename = svgUri.split("/").pop();
    if (!filename?.endsWith(".svg")) {
      console.warn(`  skip ${entry.symbol} (unexpected uri: ${svgUri})`);
      continue;
    }

    const outPath = join(OUT_DIR, filename);

    try {
      const svgRes = await fetch(svgUri, {
        headers: { "User-Agent": USER_AGENT },
      });

      if (!svgRes.ok) {
        throw new Error(`${svgRes.status} ${svgRes.statusText}`);
      }

      const svgText = await svgRes.text();
      await writeFile(outPath, svgText, "utf8");
      console.log(`  ✓ ${filename.padEnd(16)} ← ${entry.symbol}`);
      ok++;
    } catch (err) {
      console.error(`  ✗ ${filename} (${entry.symbol}): ${err.message}`);
      failed++;
    }

    // Be polite to Scryfall (they ask for ~50–100 ms between requests)
    await new Promise((r) => setTimeout(r, 80));
  }

  const files = await readdir(OUT_DIR);
  const svgCount = files.filter((f) => f.endsWith(".svg")).length;

  console.log(`\nDone. ${ok} downloaded, ${failed} failed.`);
  console.log(`public/symbols/ now contains ${svgCount} SVG files.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
