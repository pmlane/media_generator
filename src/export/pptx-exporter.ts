/**
 * PPTX export orchestration
 *
 * Writes layout JSON to a temp file, shells out to the Python script,
 * and returns the generated .pptx path.
 */

import { execFileSync } from "child_process";
import { writeFileSync, mkdirSync, unlinkSync } from "fs";
import path from "path";
import type { TextLayout } from "../text/layout.js";

const SCRIPT_PATH = path.resolve(
  import.meta.dirname ?? path.dirname(new URL(import.meta.url).pathname),
  "../../scripts/generate-pptx.py"
);

/**
 * Export a PPTX file with the background image and editable text boxes.
 *
 * @param backgroundPath  Path to the background PNG
 * @param layout          Text layout with pixel coordinates
 * @param outputPath      Where to save the .pptx file
 * @returns The output path on success
 */
export function exportPptx(
  backgroundPath: string,
  layout: TextLayout,
  outputPath: string
): string {
  // Write layout JSON to a temp file next to the output
  const outputDir = path.dirname(outputPath);
  mkdirSync(outputDir, { recursive: true });

  const layoutJsonPath = outputPath.replace(/\.pptx$/, ".layout.json");
  writeFileSync(layoutJsonPath, JSON.stringify(layout, null, 2));

  try {
    execFileSync("python3", [SCRIPT_PATH, backgroundPath, layoutJsonPath, outputPath], {
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 30_000,
    });
    return outputPath;
  } finally {
    // Clean up temp layout file
    try {
      unlinkSync(layoutJsonPath);
    } catch {
      // ignore cleanup errors
    }
  }
}
