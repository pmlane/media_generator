/**
 * PDF export orchestration
 *
 * Reads background image, resolves fonts, calls the pure renderer,
 * and writes the PDF to disk. Mirrors the pptx-exporter interface.
 */

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import path from "path";
import { homedir } from "os";
import type { TextLayout } from "../text/layout.js";
import { renderPdf, type FontPaths } from "./pdf-renderer.js";

const FONTS_DIR = path.join(homedir(), "Library", "Fonts");

/** Default font filename mapping (macOS ~/Library/Fonts) */
const DEFAULT_FONT_MAP: Record<string, FontPaths> = {
  oswald: {
    heading: path.join(FONTS_DIR, "Oswald[wght].ttf"),
    bodyRegular: path.join(FONTS_DIR, "LibreFranklin-Regular.otf"),
    bodyBold: path.join(FONTS_DIR, "LibreFranklin-Bold.otf"),
  },
};

/**
 * Export an editable PDF with background image and text overlay.
 *
 * @param backgroundPath  Path to the background PNG/JPEG
 * @param layout          Text layout with pixel coordinates
 * @param outputPath      Where to save the PDF
 * @param dpi             Image DPI (for coordinate conversion)
 * @param fontPaths       Optional explicit font paths; auto-resolved if omitted
 * @returns               The output path on success
 */
export async function exportPdf(
  backgroundPath: string,
  layout: TextLayout,
  outputPath: string,
  dpi: number,
  fontPaths?: FontPaths
): Promise<string> {
  const outputDir = path.dirname(outputPath);
  mkdirSync(outputDir, { recursive: true });

  const bgBuffer = readFileSync(backgroundPath);
  const fonts = fontPaths ?? DEFAULT_FONT_MAP["oswald"];

  const fontBytes = {
    heading: new Uint8Array(readFileSync(fonts.heading)),
    bodyRegular: new Uint8Array(readFileSync(fonts.bodyRegular)),
    bodyBold: new Uint8Array(readFileSync(fonts.bodyBold)),
  };

  const pdfBytes = await renderPdf(bgBuffer, backgroundPath, layout, fontBytes, dpi);
  writeFileSync(outputPath, pdfBytes);
  return outputPath;
}
