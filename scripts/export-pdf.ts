/**
 * Export an editable PDF with background image + text objects.
 * Usage: npx tsx scripts/export-pdf.ts <background.png> <menu.txt> [options]
 *   --title "..."          Menu title (default: "Menu")
 *   --accent-color "#hex"  Heading color override
 *   --heading-font "Name"  Heading font override
 *   --body-font "Name"     Body font override
 */

import { readFileSync } from "fs";
import { measureClearZone } from "../src/text/measure.js";
import { calculateMenuLayout } from "../src/text/layout.js";
import { parseMenuText } from "../src/content/content-loader.js";
import { loadBrand } from "../src/brands/loader.js";
import { TABLE_TENT } from "../src/media/formats.js";
import { exportPdf } from "../src/export/pdf-exporter.js";

// --- Arg parsing ---

function getFlag(name: string): string | undefined {
  const idx = process.argv.indexOf(name);
  return idx >= 0 ? process.argv[idx + 1] : undefined;
}

const bgPath = process.argv[2];
const menuPath = process.argv[3];
const title = getFlag("--title") ?? "Menu";
const accentColor = getFlag("--accent-color");
const headingFont = getFlag("--heading-font");
const bodyFont = getFlag("--body-font");

if (!bgPath || !menuPath) {
  console.error(
    "Usage: npx tsx scripts/export-pdf.ts <background.png> <menu.txt> [--title '...'] [--accent-color '#hex'] [--heading-font '...'] [--body-font '...']"
  );
  process.exit(1);
}

// --- Load inputs ---

const bgBuffer = readFileSync(bgPath);
const menuText = readFileSync(menuPath, "utf-8");
const content = parseMenuText(menuText, title);
const brand = loadBrand("triple-lindy");
const format = TABLE_TENT;

// --- Measure clear zone and compute layout ---

const clearZone = await measureClearZone(bgBuffer);
console.log("Clear zone:", clearZone);

const layout = calculateMenuLayout(content, brand, format, clearZone, {
  accentColor,
  headingFont,
  bodyFont,
});
console.log(`Layout: ${layout.elements.length} elements`);

// --- Export PDF ---

const outPath = bgPath.replace(/\.(png|jpg|jpeg)$/i, "-editable.pdf");
await exportPdf(bgPath, layout, outPath, format.dpi);

const PX_TO_PT = 72 / format.dpi;
const pageWidthPt = layout.width * PX_TO_PT;
const pageHeightPt = layout.height * PX_TO_PT;
console.log(`Saved: ${outPath}`);
console.log(`  Page size: ${pageWidthPt.toFixed(1)} x ${pageHeightPt.toFixed(1)} pt (${(pageWidthPt / 72).toFixed(1)} x ${(pageHeightPt / 72).toFixed(1)} in)`);
