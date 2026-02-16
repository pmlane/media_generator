import { measureClearZone } from "../src/text/measure.js";
import { readFileSync } from "fs";

const bg = readFileSync("output/triple-lindy/2026-02-14/ghost-skeletour/print_menu_table_tent_v1-background.png");
measureClearZone(bg).then(zone => {
  console.log("Image size: 1500x2100");
  console.log("Clear zone:", JSON.stringify(zone, null, 2));
  console.log(`Width: ${zone.right - zone.left}px (${Math.round((zone.right - zone.left)/1500*100)}%)`);
  console.log(`Height: ${zone.bottom - zone.top}px (${Math.round((zone.bottom - zone.top)/2100*100)}%)`);
  console.log(`Left margin: ${zone.left}px`);
  console.log(`Right margin: ${1500 - zone.right}px`);
  console.log(`Top: ${zone.top}px (${Math.round(zone.top/2100*100)}%)`);
  console.log(`Bottom: ${zone.bottom}px (${Math.round(zone.bottom/2100*100)}%)`);
});
