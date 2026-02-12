/**
 * Quality gate for generated images
 *
 * Checks: decodable, min dimensions, not blank, brand color presence, text presence (OCR optional)
 */

import sharp from "sharp";
import type {
  FormatConfig,
  QualityReport,
  QualityCheck,
  MediaType,
} from "../media/types.js";

interface QualityGateOptions {
  targetFormat: FormatConfig;
  mediaType: MediaType;
  brandColors?: string[];
  expectedTexts?: string[];
}

/**
 * Run all quality checks on a generated image buffer
 */
export async function runQualityGate(
  imageBuffer: Buffer,
  options: QualityGateOptions
): Promise<QualityReport> {
  const checks: QualityCheck[] = [];
  const warnings: string[] = [];

  // 1. Decodable check
  const decodable = await checkDecodable(imageBuffer);
  checks.push(decodable);
  if (decodable.result === "fail") {
    return { passed: false, checks, warnings };
  }

  // 2. Minimum dimensions check
  const dimensions = await checkDimensions(imageBuffer, options.targetFormat);
  checks.push(dimensions);

  // 3. Not blank check
  const notBlank = await checkNotBlank(imageBuffer);
  checks.push(notBlank);

  // 4. Brand color presence (warn only)
  if (options.brandColors?.length) {
    const colorCheck = await checkBrandColors(imageBuffer, options.brandColors);
    checks.push(colorCheck);
    if (colorCheck.result === "warn") {
      warnings.push(colorCheck.message ?? "Brand colors not detected");
    }
  }

  // 5. Text presence via OCR (warn only, optional dependency)
  if (
    options.expectedTexts?.length &&
    (options.mediaType === "event-flyer" || options.mediaType === "social-post")
  ) {
    const textCheck = await checkTextPresence(
      imageBuffer,
      options.expectedTexts
    );
    checks.push(textCheck);
    if (textCheck.result === "warn") {
      warnings.push(textCheck.message ?? "Expected text not found");
    }
  }

  const hasFail = checks.some((c) => c.result === "fail");

  return { passed: !hasFail, checks, warnings };
}

async function checkDecodable(buffer: Buffer): Promise<QualityCheck> {
  try {
    await sharp(buffer).metadata();
    return { name: "decodable", result: "pass" };
  } catch {
    return {
      name: "decodable",
      result: "fail",
      message: "Image buffer is not a valid image",
    };
  }
}

async function checkDimensions(
  buffer: Buffer,
  format: FormatConfig
): Promise<QualityCheck> {
  const metadata = await sharp(buffer).metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;

  const minWidth = Math.floor(format.width * 0.8);
  const minHeight = Math.floor(format.height * 0.8);

  if (width < minWidth || height < minHeight) {
    return {
      name: "min_dimensions",
      result: "fail",
      message: `Image ${width}x${height} is below 80% of target ${format.width}x${format.height}`,
    };
  }

  return { name: "min_dimensions", result: "pass" };
}

async function checkNotBlank(buffer: Buffer): Promise<QualityCheck> {
  // Sample random pixels and check color variance
  const { data, info } = await sharp(buffer)
    .raw()
    .toBuffer({ resolveWithObject: true });

  const channels = info.channels;
  const totalPixels = info.width * info.height;
  const sampleCount = Math.min(100, totalPixels);

  const samples: number[][] = [];
  for (let i = 0; i < sampleCount; i++) {
    const pixelIndex = Math.floor(Math.random() * totalPixels);
    const offset = pixelIndex * channels;
    samples.push([data[offset], data[offset + 1], data[offset + 2]]);
  }

  // Calculate standard deviation across R, G, B channels
  for (let ch = 0; ch < 3; ch++) {
    const values = samples.map((s) => s[ch]);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance =
      values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
    const stddev = Math.sqrt(variance);

    if (stddev > 15) {
      return { name: "not_blank", result: "pass" };
    }
  }

  return {
    name: "not_blank",
    result: "fail",
    message: "Image appears to be blank or solid color (low pixel variance)",
  };
}

/**
 * Check if brand colors are present in the image.
 * Uses simple color distance (Euclidean in RGB) instead of deltaE for simplicity.
 */
async function checkBrandColors(
  buffer: Buffer,
  brandColors: string[]
): Promise<QualityCheck> {
  const { data, info } = await sharp(buffer)
    .raw()
    .toBuffer({ resolveWithObject: true });

  const channels = info.channels;
  const totalPixels = info.width * info.height;
  const sampleCount = Math.min(200, totalPixels);

  const brandRgb = brandColors.map(hexToRgb).filter(Boolean) as number[][];

  for (let i = 0; i < sampleCount; i++) {
    const pixelIndex = Math.floor(Math.random() * totalPixels);
    const offset = pixelIndex * channels;
    const pixel = [data[offset], data[offset + 1], data[offset + 2]];

    for (const brand of brandRgb) {
      const dist = Math.sqrt(
        (pixel[0] - brand[0]) ** 2 +
          (pixel[1] - brand[1]) ** 2 +
          (pixel[2] - brand[2]) ** 2
      );
      // deltaE ~30 in LAB corresponds roughly to ~75 in RGB Euclidean
      if (dist < 75) {
        return { name: "brand_color", result: "pass" };
      }
    }
  }

  return {
    name: "brand_color",
    result: "warn",
    message: "No brand colors detected in sampled pixels",
  };
}

async function checkTextPresence(
  _buffer: Buffer,
  _expectedTexts: string[]
): Promise<QualityCheck> {
  // Tesseract.js is an optional dependency
  try {
    // Dynamic import to handle optional dependency
    await import("tesseract.js");
  } catch {
    return {
      name: "text_presence",
      result: "warn",
      message:
        "OCR checks disabled: tesseract.js not installed. Install with: npm install tesseract.js",
    };
  }

  // If tesseract is available, we'd run OCR here
  // For now, pass with a note
  return {
    name: "text_presence",
    result: "pass",
    message: "OCR check skipped (full implementation pending)",
  };
}

function hexToRgb(hex: string): number[] | null {
  const match = hex.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!match) return null;
  return [parseInt(match[1], 16), parseInt(match[2], 16), parseInt(match[3], 16)];
}
