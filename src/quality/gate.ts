/**
 * Quality gate for generated images
 *
 * Checks: decodable, min dimensions, not blank, brand color presence, aspect ratio
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

  // 3. Compute stats once for blank + brand color checks
  const stats = await sharp(imageBuffer).stats();

  // 4. Not blank check (uses stats)
  const notBlank = checkNotBlankFromStats(stats);
  checks.push(notBlank);

  // 5. Brand color presence (warn only, uses stats)
  if (options.brandColors?.length) {
    const colorCheck = checkBrandColorsFromStats(stats, options.brandColors);
    checks.push(colorCheck);
    if (colorCheck.result === "warn") {
      warnings.push(colorCheck.message ?? "Brand colors not detected");
    }
  }

  // 6. Aspect ratio check (warn only)
  const ratioCheck = await checkAspectRatio(imageBuffer, options.targetFormat);
  checks.push(ratioCheck);
  if (ratioCheck.result === "warn") {
    warnings.push(ratioCheck.message ?? "Aspect ratio mismatch");
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

/**
 * Check that the image is not blank or near-uniform using sharp stats.
 *
 * Three-tier check:
 * - Fail if max channel stdev < 5 (solid color)
 * - Fail if max channel range (max-min) < 30 (near-uniform gradient)
 * - Warn if total stdev across all channels < 20 (low diversity)
 */
function checkNotBlankFromStats(stats: sharp.Stats): QualityCheck {
  const channels = stats.channels.slice(0, 3); // R, G, B only

  const maxStdev = Math.max(...channels.map((c) => c.stdev));
  if (maxStdev < 5) {
    return {
      name: "not_blank",
      result: "fail",
      message: "Image appears to be blank or solid color (max channel stdev < 5)",
    };
  }

  const maxRange = Math.max(...channels.map((c) => c.max - c.min));
  if (maxRange < 30) {
    return {
      name: "not_blank",
      result: "fail",
      message: "Image appears to be a near-uniform gradient (max channel range < 30)",
    };
  }

  const totalStdev = channels.reduce((sum, c) => sum + c.stdev, 0);
  if (totalStdev < 20) {
    return {
      name: "not_blank",
      result: "warn",
      message: "Image has low color diversity (total stdev < 20)",
    };
  }

  return { name: "not_blank", result: "pass" };
}

/**
 * Check if brand colors are present using stats dominant color and channel means.
 *
 * - Check dominant color distance to each brand color
 * - Check channel mean color distance to each brand color
 * - Pass if closest distance < 100
 * - Warn with diagnostic info if no match
 */
function checkBrandColorsFromStats(
  stats: sharp.Stats,
  brandColors: string[]
): QualityCheck {
  const brandRgb = brandColors.map(hexToRgb).filter(Boolean) as number[][];
  if (brandRgb.length === 0) {
    return { name: "brand_color", result: "pass" };
  }

  const dominant = [
    stats.dominant.r,
    stats.dominant.g,
    stats.dominant.b,
  ];

  const channels = stats.channels.slice(0, 3);
  const meanColor = [channels[0].mean, channels[1].mean, channels[2].mean];

  let closestDistance = Infinity;

  for (const brand of brandRgb) {
    const domDist = rgbDistance(dominant, brand);
    const meanDist = rgbDistance(meanColor, brand);
    const minDist = Math.min(domDist, meanDist);
    if (minDist < closestDistance) {
      closestDistance = minDist;
    }
  }

  if (closestDistance < 100) {
    return { name: "brand_color", result: "pass" };
  }

  return {
    name: "brand_color",
    result: "warn",
    message: `No brand colors detected (dominant: rgb(${dominant.join(", ")}), closest distance: ${Math.round(closestDistance)})`,
  };
}

function rgbDistance(a: number[], b: number[]): number {
  return Math.sqrt(
    (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2
  );
}

async function checkAspectRatio(
  buffer: Buffer,
  format: FormatConfig
): Promise<QualityCheck> {
  const metadata = await sharp(buffer).metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;

  if (width === 0 || height === 0) {
    return { name: "aspect_ratio", result: "pass" };
  }

  const actualRatio = width / height;
  const targetRatio = format.width / format.height;
  const deviation = Math.abs(actualRatio - targetRatio) / targetRatio;

  if (deviation > 0.05) {
    return {
      name: "aspect_ratio",
      result: "warn",
      message: `Aspect ratio ${actualRatio.toFixed(3)} deviates ${(deviation * 100).toFixed(1)}% from target ${targetRatio.toFixed(3)}`,
    };
  }

  return { name: "aspect_ratio", result: "pass" };
}

function hexToRgb(hex: string): number[] | null {
  const match = hex.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!match) return null;
  return [parseInt(match[1], 16), parseInt(match[2], 16), parseInt(match[3], 16)];
}
