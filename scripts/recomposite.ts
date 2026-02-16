/**
 * Re-composite text overlay onto an existing background image.
 * Usage: npx tsx scripts/recomposite.ts <background.png> <menu.txt> [options]
 *   --title "..."          Menu title (default: "Menu")
 *   --accent-color "#hex"  Heading color override
 *   --heading-font "Name"  Heading font override
 *   --body-font "Name"     Body font override
 */

import { readFileSync, writeFileSync } from "fs";
import sharp from "sharp";
import { measureClearZone } from "../src/text/measure.js";
import { calculateMenuLayout } from "../src/text/layout.js";
import { renderTextSvg } from "../src/text/svg-renderer.js";
import { parseMenuText } from "../src/content/content-loader.js";
import { loadBrand } from "../src/brands/loader.js";
import { TABLE_TENT } from "../src/media/formats.js";

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
  console.error("Usage: npx tsx scripts/recomposite.ts <background.png> <menu.txt> [--title '...'] [--accent-color '#hex'] [--heading-font '...'] [--body-font '...']");
  process.exit(1);
}

const bgBuffer = readFileSync(bgPath);
const menuText = readFileSync(menuPath, "utf-8");
const content = parseMenuText(menuText, title);
const brand = loadBrand("triple-lindy");
const format = TABLE_TENT;

const clearZone = await measureClearZone(bgBuffer);
console.log("Clear zone:", clearZone);

const layout = calculateMenuLayout(content, brand, format, clearZone, {
  accentColor,
  headingFont,
  bodyFont,
});
console.log(`Layout: ${layout.elements.length} elements`);
if (accentColor) console.log(`  accent: ${accentColor}`);
if (headingFont) console.log(`  heading font: ${headingFont}`);
if (bodyFont) console.log(`  body font: ${bodyFont}`);

const textSvg = renderTextSvg(layout);

const result = await sharp(bgBuffer)
  .composite([{ input: textSvg, top: 0, left: 0 }])
  .png()
  .toBuffer();

const outPath = bgPath.replace(/-background\.png$/, "-recomp.png");
writeFileSync(outPath, result);
console.log(`Saved: ${outPath}`);
