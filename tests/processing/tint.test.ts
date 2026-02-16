import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { tintLogo, parseHex } from "@/processing/tint";

describe("parseHex", () => {
  it("parses #RRGGBB format", () => {
    expect(parseHex("#7213A5")).toEqual({ r: 0x72, g: 0x13, b: 0xa5 });
  });

  it("parses #RGB shorthand", () => {
    expect(parseHex("#F00")).toEqual({ r: 255, g: 0, b: 0 });
  });

  it("handles missing # prefix", () => {
    expect(parseHex("00FF00")).toEqual({ r: 0, g: 255, b: 0 });
  });
});

describe("tintLogo", () => {
  it("tints an opaque PNG to the target color", async () => {
    const white = await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      },
    })
      .png()
      .toBuffer();

    const tinted = await tintLogo(white, "#7213A5");

    const meta = await sharp(tinted).metadata();
    expect(meta.width).toBe(100);
    expect(meta.height).toBe(100);
    expect(meta.channels).toBe(4);

    const { data } = await sharp(tinted).raw().toBuffer({ resolveWithObject: true });
    // First pixel should be the target color, fully opaque
    expect(data[0]).toBe(0x72);
    expect(data[1]).toBe(0x13);
    expect(data[2]).toBe(0xa5);
    expect(data[3]).toBe(255);
  });

  it("preserves transparent areas", async () => {
    const transparent = await sharp({
      create: {
        width: 10,
        height: 10,
        channels: 4,
        background: { r: 255, g: 0, b: 0, alpha: 0 },
      },
    })
      .png()
      .toBuffer();

    const tinted = await tintLogo(transparent, "#00FF00");

    const { data } = await sharp(tinted).raw().toBuffer({ resolveWithObject: true });
    // Alpha should remain 0
    expect(data[3]).toBe(0);
  });

  it("preserves partial alpha values", async () => {
    // Create an image with 50% alpha
    const semiTransparent = await sharp({
      create: {
        width: 10,
        height: 10,
        channels: 4,
        background: { r: 200, g: 200, b: 200, alpha: 0.5 },
      },
    })
      .png()
      .toBuffer();

    const tinted = await tintLogo(semiTransparent, "#FF0000");

    const { data } = await sharp(tinted).raw().toBuffer({ resolveWithObject: true });
    // Color should be target red
    expect(data[0]).toBe(255);
    expect(data[1]).toBe(0);
    expect(data[2]).toBe(0);
    // Alpha should be approximately 128 (50%)
    expect(data[3]).toBeGreaterThan(120);
    expect(data[3]).toBeLessThan(135);
  });
});
