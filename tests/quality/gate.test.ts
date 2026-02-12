import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { runQualityGate } from "@/quality/gate";
import { INSTAGRAM_SQUARE } from "@/media/formats";

describe("Quality Gate", () => {
  describe("Decodable check", () => {
    it("passes for valid PNG", async () => {
      const buffer = await sharp({
        create: { width: 1080, height: 1080, channels: 3, background: { r: 128, g: 64, b: 64 } },
      }).png().toBuffer();

      // Add variation so it doesn't fail blank check
      const overlay = Buffer.from(
        `<svg width="1080" height="1080"><rect x="0" y="0" width="540" height="1080" fill="#E02020"/></svg>`
      );
      const varied = await sharp(buffer)
        .composite([{ input: overlay, blend: "over" }])
        .png()
        .toBuffer();

      const report = await runQualityGate(varied, {
        targetFormat: INSTAGRAM_SQUARE,
        mediaType: "social-post",
      });

      const decodable = report.checks.find((c) => c.name === "decodable");
      expect(decodable?.result).toBe("pass");
    });

    it("fails for invalid buffer", async () => {
      const report = await runQualityGate(Buffer.from("not an image"), {
        targetFormat: INSTAGRAM_SQUARE,
        mediaType: "social-post",
      });

      expect(report.passed).toBe(false);
      const decodable = report.checks.find((c) => c.name === "decodable");
      expect(decodable?.result).toBe("fail");
    });
  });

  describe("Dimension check", () => {
    it("passes for correctly sized image", async () => {
      const buffer = await createVariedImage(1080, 1080);

      const report = await runQualityGate(buffer, {
        targetFormat: INSTAGRAM_SQUARE,
        mediaType: "social-post",
      });

      const dimCheck = report.checks.find((c) => c.name === "min_dimensions");
      expect(dimCheck?.result).toBe("pass");
    });

    it("fails for undersized image", async () => {
      const buffer = await createVariedImage(200, 200);

      const report = await runQualityGate(buffer, {
        targetFormat: INSTAGRAM_SQUARE,
        mediaType: "social-post",
      });

      const dimCheck = report.checks.find((c) => c.name === "min_dimensions");
      expect(dimCheck?.result).toBe("fail");
    });
  });

  describe("Blank check", () => {
    it("passes for varied image", async () => {
      const buffer = await createVariedImage(1080, 1080);

      const report = await runQualityGate(buffer, {
        targetFormat: INSTAGRAM_SQUARE,
        mediaType: "social-post",
      });

      const blank = report.checks.find((c) => c.name === "not_blank");
      expect(blank?.result).toBe("pass");
    });

    it("fails for solid white image", async () => {
      const buffer = await sharp({
        create: { width: 1080, height: 1080, channels: 3, background: { r: 255, g: 255, b: 255 } },
      }).png().toBuffer();

      const report = await runQualityGate(buffer, {
        targetFormat: INSTAGRAM_SQUARE,
        mediaType: "social-post",
      });

      const blank = report.checks.find((c) => c.name === "not_blank");
      expect(blank?.result).toBe("fail");
    });
  });

  describe("Brand color check", () => {
    it("passes when brand color is present", async () => {
      // Image with brand red (#E02020)
      const buffer = await sharp({
        create: { width: 1080, height: 1080, channels: 3, background: { r: 224, g: 32, b: 32 } },
      }).png().toBuffer();

      // Add variation
      const overlay = Buffer.from(
        `<svg width="1080" height="1080"><rect x="0" y="0" width="540" height="1080" fill="#1C1C1C"/></svg>`
      );
      const varied = await sharp(buffer)
        .composite([{ input: overlay, blend: "over" }])
        .png()
        .toBuffer();

      const report = await runQualityGate(varied, {
        targetFormat: INSTAGRAM_SQUARE,
        mediaType: "social-post",
        brandColors: ["#E02020", "#1C1C1C"],
      });

      const colorCheck = report.checks.find((c) => c.name === "brand_color");
      expect(colorCheck?.result).toBe("pass");
    });

    it("warns when brand colors are absent", async () => {
      // Image with colors very different from brand
      const buffer = await createVariedImage(1080, 1080, "#00FF00", "#0000FF");

      const report = await runQualityGate(buffer, {
        targetFormat: INSTAGRAM_SQUARE,
        mediaType: "social-post",
        brandColors: ["#E02020", "#D6B38D"],
      });

      const colorCheck = report.checks.find((c) => c.name === "brand_color");
      expect(colorCheck?.result).toBe("warn");
    });
  });

  describe("Overall report", () => {
    it("passes with all checks passing", async () => {
      const buffer = await createVariedImage(1080, 1080);

      const report = await runQualityGate(buffer, {
        targetFormat: INSTAGRAM_SQUARE,
        mediaType: "social-post",
      });

      expect(report.passed).toBe(true);
    });

    it("fails if any hard check fails", async () => {
      const report = await runQualityGate(Buffer.from("bad"), {
        targetFormat: INSTAGRAM_SQUARE,
        mediaType: "social-post",
      });

      expect(report.passed).toBe(false);
    });
  });
});

/** Helper: create an image with two-tone variation */
async function createVariedImage(
  width: number,
  height: number,
  color1 = "#E02020",
  color2 = "#1C1C1C"
): Promise<Buffer> {
  const base = await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: parseInt(color2.slice(1, 3), 16), g: parseInt(color2.slice(3, 5), 16), b: parseInt(color2.slice(5, 7), 16) },
    },
  }).png().toBuffer();

  const halfWidth = Math.floor(width / 2);
  const overlay = Buffer.from(
    `<svg width="${width}" height="${height}"><rect x="0" y="0" width="${halfWidth}" height="${height}" fill="${color1}"/></svg>`
  );

  return sharp(base)
    .composite([{ input: overlay, blend: "over" }])
    .png()
    .toBuffer();
}
