/**
 * Print post-processing
 *
 * Proof mode (default): 300 DPI RGB PNG with bleed area and crop marks
 * Print-service mode: stub for future CMYK/PDF/X pipeline
 */

import sharp from "sharp";
import type { FormatConfig } from "../media/types.js";

interface PrintProcessOptions {
  printReady?: boolean;
}

/**
 * Process a generated image for print output
 *
 * Adds bleed area around the image and optional crop marks.
 */
export async function processPrintImage(
  imageBuffer: Buffer,
  format: FormatConfig,
  options?: PrintProcessOptions
): Promise<Buffer> {
  const bleed = format.bleed ?? 38;

  // Target size is the trim size (without bleed)
  const trimWidth = format.width;
  const trimHeight = format.height;

  // Final canvas includes bleed on all sides
  const canvasWidth = trimWidth + bleed * 2;
  const canvasHeight = trimHeight + bleed * 2;

  // Resize the image to fill the full canvas (trim + bleed)
  const resized = await sharp(imageBuffer)
    .resize(canvasWidth, canvasHeight, {
      fit: "cover",
      position: "center",
    })
    .removeAlpha()
    .png()
    .toBuffer();

  // Add crop marks
  const withCropMarks = await addCropMarks(resized, canvasWidth, canvasHeight, bleed);

  if (options?.printReady) {
    console.warn(
      "Professional CMYK conversion not yet available. Exporting high-res RGB PNG with bleed."
    );
  }

  return withCropMarks;
}

/**
 * Draw crop marks at the corners of the trim area
 */
async function addCropMarks(
  imageBuffer: Buffer,
  canvasWidth: number,
  canvasHeight: number,
  bleed: number
): Promise<Buffer> {
  const markLength = Math.min(20, bleed - 2);
  const markWidth = 1;

  if (markLength <= 0) {
    return imageBuffer;
  }

  // Create SVG overlay with crop marks
  const marks = generateCropMarksSvg(
    canvasWidth,
    canvasHeight,
    bleed,
    markLength,
    markWidth
  );

  return sharp(imageBuffer)
    .composite([
      {
        input: Buffer.from(marks),
        top: 0,
        left: 0,
      },
    ])
    .png()
    .toBuffer();
}

function generateCropMarksSvg(
  width: number,
  height: number,
  bleed: number,
  markLength: number,
  markWidth: number
): string {
  // Trim boundaries
  const left = bleed;
  const top = bleed;
  const right = width - bleed;
  const bottom = height - bleed;

  const lines: string[] = [];

  // Top-left corner
  lines.push(
    `<line x1="${left - markLength}" y1="${top}" x2="${left - 2}" y2="${top}" />`
  );
  lines.push(
    `<line x1="${left}" y1="${top - markLength}" x2="${left}" y2="${top - 2}" />`
  );

  // Top-right corner
  lines.push(
    `<line x1="${right + 2}" y1="${top}" x2="${right + markLength}" y2="${top}" />`
  );
  lines.push(
    `<line x1="${right}" y1="${top - markLength}" x2="${right}" y2="${top - 2}" />`
  );

  // Bottom-left corner
  lines.push(
    `<line x1="${left - markLength}" y1="${bottom}" x2="${left - 2}" y2="${bottom}" />`
  );
  lines.push(
    `<line x1="${left}" y1="${bottom + 2}" x2="${left}" y2="${bottom + markLength}" />`
  );

  // Bottom-right corner
  lines.push(
    `<line x1="${right + 2}" y1="${bottom}" x2="${right + markLength}" y2="${bottom}" />`
  );
  lines.push(
    `<line x1="${right}" y1="${bottom + 2}" x2="${right}" y2="${bottom + markLength}" />`
  );

  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <g stroke="black" stroke-width="${markWidth}">
    ${lines.join("\n    ")}
  </g>
</svg>`;
}
