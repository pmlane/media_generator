import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { measureClearZone } from "@/text/measure";

/**
 * Build a raw RGB image buffer of uniform color.
 * Returns a PNG buffer for measureClearZone.
 */
async function solidImage(width: number, height: number, r = 100, g = 100, b = 100): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r, g, b } },
  }).png().toBuffer();
}

/**
 * Build an image with noisy rows at specified ranges and solid elsewhere.
 * Noise alternates at 50-pixel boundaries to match SAMPLE_STEP=50,
 * so the sampled pixels have high stdev across each row.
 */
async function noisyBandsImage(
  width: number,
  height: number,
  noisyRanges: Array<[number, number]>,
): Promise<Buffer> {
  const pixels = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y++) {
    const isNoisy = noisyRanges.some(([start, end]) => y >= start && y < end);
    for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * 3;
      if (isNoisy) {
        // Alternate at 50px boundaries so SAMPLE_STEP=50 sees variation
        const val = Math.floor(x / 50) % 2 === 0 ? 20 : 230;
        pixels[offset] = val;
        pixels[offset + 1] = val;
        pixels[offset + 2] = val;
      } else {
        pixels[offset] = 100;
        pixels[offset + 1] = 100;
        pixels[offset + 2] = 100;
      }
    }
  }
  return sharp(pixels, { raw: { width, height, channels: 3 } }).png().toBuffer();
}

describe("measureClearZone", () => {
  it("detects entire solid image as clear", async () => {
    const buf = await solidImage(500, 1000);
    const zone = await measureClearZone(buf);

    expect(zone.top).toBeLessThan(100);
    expect(zone.bottom).toBeGreaterThan(900);
    expect(zone.left).toBeLessThan(50);
    expect(zone.right).toBeGreaterThan(450);
  });

  it("finds clear center with busy top and bottom edges", async () => {
    // Rows 0-200 noisy, 200-800 solid, 800-1000 noisy
    const buf = await noisyBandsImage(500, 1000, [[0, 200], [800, 1000]]);
    const zone = await measureClearZone(buf);

    // Clear zone should be roughly 200-800
    expect(zone.top).toBeGreaterThanOrEqual(150);
    expect(zone.top).toBeLessThanOrEqual(250);
    expect(zone.bottom).toBeGreaterThanOrEqual(750);
    expect(zone.bottom).toBeLessThanOrEqual(850);
  });

  it("falls back to middle region when image is very busy", async () => {
    // Entire image noisy — alternating at 50px boundaries to match SAMPLE_STEP
    const buf = await noisyBandsImage(500, 1000, [[0, 1000]]);
    const zone = await measureClearZone(buf);

    // Fallback: top=25%, bottom=80%
    expect(zone.top).toBe(Math.round(1000 * 0.25));
    expect(zone.bottom).toBe(Math.round(1000 * 0.80));
  });

  it("detects left/right noisy margins", async () => {
    const width = 600;
    const height = 1000;
    const pixels = Buffer.alloc(width * height * 3);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const offset = (y * width + x) * 3;
        if (x < 100 || x >= 500) {
          // Noisy margins — use distinct colors per column for high deviation
          // from the center reference color
          pixels[offset] = 250;     // very different from center (100)
          pixels[offset + 1] = 20;
          pixels[offset + 2] = 20;
        } else {
          // Solid center
          pixels[offset] = 100;
          pixels[offset + 1] = 100;
          pixels[offset + 2] = 100;
        }
      }
    }
    const buf = await sharp(pixels, { raw: { width, height, channels: 3 } }).png().toBuffer();
    const zone = await measureClearZone(buf);

    expect(zone.left).toBeGreaterThan(0);
    expect(zone.right).toBeLessThan(width);
  });
});
