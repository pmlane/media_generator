import { readFileSync } from "fs";
import { measureClearZone } from "../src/text/measure.js";
import { calculateMenuLayout } from "../src/text/layout.js";
import { parseMenuText } from "../src/content/content-loader.js";
import { loadBrand } from "../src/brands/loader.js";
import { TABLE_TENT } from "../src/media/formats.js";

const bg = readFileSync("output/triple-lindy/2026-02-14/ghost-skeletour/print_menu_table_tent_v1-background.png");
const menuText = readFileSync("content/ghost-fan-party.txt", "utf-8");
const content = parseMenuText(menuText, "Ghost Fan Party");
const brand = loadBrand("triple-lindy");
const format = TABLE_TENT;

measureClearZone(bg).then((clearZone) => {
  const layout = calculateMenuLayout(content, brand, format, clearZone, {
    accentColor: "#7213A5",
    headingFont: "Playfair Display",
    bodyFont: "Baskerville",
  });

  console.log("Clear zone:", clearZone);
  console.log("Canvas:", layout.width, "x", layout.height);
  console.log("Menu zone bottom:", clearZone.bottom - 50); // footerZoneTop approx
  console.log("\nElements:");
  for (const el of layout.elements) {
    console.log(`  y=${el.y}  size=${el.fontSize}  ${el.fontWeight.padEnd(6)}  ${el.anchor.padEnd(6)}  "${el.text.slice(0, 70)}"`);
  }
});
