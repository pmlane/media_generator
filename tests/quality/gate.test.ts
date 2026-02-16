import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { runQualityGate } from "@/quality/gate";
import { INSTAGRAM_SQUARE } from "@/media/formats";

describe("Quality Gate", () => {
  describe("Decodable check", () => {
    it("passes for valid PNG", async () => {
      const buffer = await createVariedImage(1080, 1080);

      const report = await runQualityGate(buffer, {
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

    it("fails for near-uniform gradient", async () => {
      // Gradient from 90 to 118 (range 28 < 30, stdev ~8 > 5)
      // Passes the solid-color check but fails the gradient check
      const width = 1080;
      const height = 1080;
      const pixels = Buffer.alloc(width * height * 3);
      for (let y = 0; y < height; y++) {
        const val = 90 + Math.floor((y / height) * 28); // 90..118
        for (let x = 0; x < width; x++) {
          const offset = (y * width + x) * 3;
          pixels[offset] = val;
          pixels[offset + 1] = val;
          pixels[offset + 2] = val;
        }
      }
      const buffer = await sharp(pixels, {
        raw: { width, height, channels: 3 },
      }).png().toBuffer();

      const report = await runQualityGate(buffer, {
        targetFormat: INSTAGRAM_SQUARE,
        mediaType: "social-post",
      });

      const blank = report.checks.find((c) => c.name === "not_blank");
      expect(blank?.result).toBe("fail");
      expect(blank?.message).toContain("near-uniform gradient");
    });

    it("warns for low-diversity image", async () => {
      // Dark image: 98% at rgb(10,10,10), 2% at rgb(50,50,50)
      // Range = 40 > 30 (passes gradient check)
      // Per-channel stdev ~5.6, total stdev ~17 < 20 (triggers warn)
      const width = 1080;
      const height = 1080;
      const stripeRows = 22; // ~2% of 1080
      const pixels = Buffer.alloc(width * height * 3);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const offset = (y * width + x) * 3;
          if (y >= 529 && y < 529 + stripeRows) {
            pixels[offset] = 50;
            pixels[offset + 1] = 50;
            pixels[offset + 2] = 50;
          } else {
            pixels[offset] = 10;
            pixels[offset + 1] = 10;
            pixels[offset + 2] = 10;
          }
        }
      }
      const buffer = await sharp(pixels, {
        raw: { width, height, channels: 3 },
      }).png().toBuffer();

      const report = await runQualityGate(buffer, {
        targetFormat: INSTAGRAM_SQUARE,
        mediaType: "social-post",
      });

      const blank = report.checks.find((c) => c.name === "not_blank");
      expect(blank?.result).toBe("warn");
      expect(blank?.message).toContain("low color diversity");
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

    it("includes diagnostic info in warning message", async () => {
      const buffer = await createVariedImage(1080, 1080, "#00FF00", "#0000FF");

      const report = await runQualityGate(buffer, {
        targetFormat: INSTAGRAM_SQUARE,
        mediaType: "social-post",
        brandColors: ["#E02020"],
      });

      const colorCheck = report.checks.find((c) => c.name === "brand_color");
      expect(colorCheck?.result).toBe("warn");
      expect(colorCheck?.message).toContain("dominant: rgb(");
      expect(colorCheck?.message).toContain("closest distance:");
    });
  });

  describe("Aspect ratio check", () => {
    it("passes for correct ratio", async () => {
      const buffer = await createVariedImage(1080, 1080);

      const report = await runQualityGate(buffer, {
        targetFormat: INSTAGRAM_SQUARE,
        mediaType: "social-post",
      });

      const ratioCheck = report.checks.find((c) => c.name === "aspect_ratio");
      expect(ratioCheck?.result).toBe("pass");
    });

    it("warns for wrong ratio", async () => {
      // 1200x600 = 2:1 vs INSTAGRAM_SQUARE 1:1
      const buffer = await createVariedImage(1200, 600);

      const report = await runQualityGate(buffer, {
        targetFormat: INSTAGRAM_SQUARE,
        mediaType: "social-post",
      });

      const ratioCheck = report.checks.find((c) => c.name === "aspect_ratio");
      expect(ratioCheck?.result).toBe("warn");
    });

    it("passes within 5% tolerance", async () => {
      // 1080x1030: ratio=1.0485, target=1.0, deviation=4.85% < 5%
      const buffer = await createVariedImage(1080, 1030);

      const report = await runQualityGate(buffer, {
        targetFormat: INSTAGRAM_SQUARE,
        mediaType: "social-post",
      });

      const ratioCheck = report.checks.find((c) => c.name === "aspect_ratio");
      expect(ratioCheck?.result).toBe("pass");
    });

    it("includes ratio details in warning message", async () => {
      const buffer = await createVariedImage(1200, 600);

      const report = await runQualityGate(buffer, {
        targetFormat: INSTAGRAM_SQUARE,
        mediaType: "social-post",
      });

      const ratioCheck = report.checks.find((c) => c.name === "aspect_ratio");
      expect(ratioCheck?.message).toContain("Aspect ratio");
      expect(ratioCheck?.message).toContain("deviates");
      expect(ratioCheck?.message).toContain("target");
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
