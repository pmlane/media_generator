/**
 * Logo tinting — recolor a transparent PNG to a solid target color
 * while preserving its alpha channel (shape).
 */

import sharp from "sharp";

/**
 * Parse a hex color string (#RGB or #RRGGBB) into { r, g, b }.
 */
export function parseHex(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace(/^#/, "");
  if (clean.length === 3) {
    return {
      r: parseInt(clean[0] + clean[0], 16),
      g: parseInt(clean[1] + clean[1], 16),
      b: parseInt(clean[2] + clean[2], 16),
    };
  }
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
}

/**
 * Tint a logo PNG to a solid color, preserving its alpha channel.
 *
 * All visible pixels become the target color; transparent areas stay transparent.
 */
export async function tintLogo(
  logoBuffer: Buffer,
  hexColor: string
): Promise<Buffer> {
  const { r, g, b } = parseHex(hexColor);
  const meta = await sharp(logoBuffer).metadata();
  if (!meta.width || !meta.height) return logoBuffer;

  // Extract alpha channel from the original logo
  const alphaChannel = await sharp(logoBuffer)
    .ensureAlpha()
    .extractChannel(3)
    .toBuffer();

  // Create a solid color rectangle, then attach the original alpha
  const solidRgb = await sharp({
    create: {
      width: meta.width,
      height: meta.height,
      channels: 3,
      background: { r, g, b },
    },
  })
    .png()
    .toBuffer();

  return sharp(solidRgb)
    .joinChannel(alphaChannel)
    .png()
    .toBuffer();
}
