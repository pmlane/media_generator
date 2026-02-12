/**
 * Social media post-processing
 * Resize to exact dimensions, ensure RGB PNG output
 */

import sharp from "sharp";
import type { FormatConfig } from "../media/types.js";

/**
 * Process a generated image for social media output
 */
export async function processSocialImage(
  imageBuffer: Buffer,
  format: FormatConfig
): Promise<Buffer> {
  return sharp(imageBuffer)
    .resize(format.width, format.height, {
      fit: "cover",
      position: "center",
    })
    .removeAlpha()
    .png()
    .toBuffer();
}
