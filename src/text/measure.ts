/**
 * Clear zone detector for AI-generated backgrounds
 *
 * Analyzes pixel data to find where the "quiet" (uniform) area is
 * on each unique background, so text overlay can be placed without
 * overlapping decorative elements or the logo.
 */

import sharp from "sharp";

export interface ClearZone {
  /** y where clear area starts */
  top: number;
  /** y where clear area ends */
  bottom: number;
  /** x where clear area starts */
  left: number;
  /** x where clear area ends */
  right: number;
}

/** Height in pixels of each horizontal analysis band */
const BAND_HEIGHT = 50;

/** Std-dev threshold: bands below this are considered "quiet" */
const BUSYNESS_THRESHOLD = 40;

/** Reject clear zones smaller than this */
const MIN_CLEAR_HEIGHT = 300;

/** Sample every Nth pixel per band (performance) */
const SAMPLE_STEP = 50;

/** Margin column sweep step */
const COL_STEP = 10;

/**
 * Measure the largest clear/quiet zone on an image.
 *
 * Uses Sharp to get raw RGB pixels, divides into horizontal bands,
 * measures per-band "busyness" (RGB std deviation), then finds the
 * longest contiguous run of quiet bands.
 */
export async function measureClearZone(imageBuffer: Buffer): Promise<ClearZone> {
  const { data, info } = await sharp(imageBuffer)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;

  // --- Horizontal band analysis ---
  const bandCount = Math.floor(height / BAND_HEIGHT);
  const busyness = new Float64Array(bandCount);

  for (let b = 0; b < bandCount; b++) {
    const yStart = b * BAND_HEIGHT;
    const yEnd = Math.min(yStart + BAND_HEIGHT, height);
    busyness[b] = measureBandBusyness(data, width, channels, yStart, yEnd);
  }

  // --- Find largest contiguous quiet zone ---
  let bestStart = 0;
  let bestLen = 0;
  let curStart = 0;
  let curLen = 0;

  for (let b = 0; b < bandCount; b++) {
    if (busyness[b] < BUSYNESS_THRESHOLD) {
      if (curLen === 0) curStart = b;
      curLen++;
    } else {
      if (curLen > bestLen) {
        bestStart = curStart;
        bestLen = curLen;
      }
      curLen = 0;
    }
  }
  if (curLen > bestLen) {
    bestStart = curStart;
    bestLen = curLen;
  }

  let top: number;
  let bottom: number;

  if (bestLen * BAND_HEIGHT >= MIN_CLEAR_HEIGHT) {
    top = bestStart * BAND_HEIGHT;
    bottom = (bestStart + bestLen) * BAND_HEIGHT;
  } else {
    // Fallback: use middle 50% of image
    top = Math.round(height * 0.25);
    bottom = Math.round(height * 0.80);
  }

  // --- Left/right margin detection ---
  // Sweep from the known-clear center outward until we hit decoration
  const { left, right } = findClearMargins(data, width, channels, top, bottom);

  return { top, bottom, left, right };
}

/**
 * Measure how "busy" a horizontal band is by computing the average
 * per-pixel RGB standard deviation across sampled pixels.
 */
function measureBandBusyness(
  data: Buffer,
  width: number,
  channels: number,
  yStart: number,
  yEnd: number
): number {
  const samples: number[] = [];

  for (let y = yStart; y < yEnd; y += SAMPLE_STEP) {
    // Collect channel values across this row's samples
    const rowValues: number[] = [];
    for (let x = 0; x < width; x += SAMPLE_STEP) {
      const idx = (y * width + x) * channels;
      // Average of RGB as a single brightness value
      const brightness = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
      rowValues.push(brightness);
    }

    if (rowValues.length > 1) {
      samples.push(stdDev(rowValues));
    }
  }

  if (samples.length === 0) return 255;
  return samples.reduce((a, b) => a + b, 0) / samples.length;
}

/**
 * Find left and right clear-area boundaries by sweeping outward from
 * the image center. Uses the center of the quiet zone as a reference
 * color, then moves left and right until pixels deviate significantly.
 *
 * This correctly handles both bordered images (decoration at edges)
 * and images with decoration in the center.
 */
function findClearMargins(
  data: Buffer,
  width: number,
  channels: number,
  top: number,
  bottom: number
): { left: number; right: number } {
  const centerX = Math.round(width / 2);
  const sampleRows = [
    Math.round(top + (bottom - top) * 0.25),
    Math.round((top + bottom) / 2),
    Math.round(top + (bottom - top) * 0.75),
  ].filter((y) => y >= top && y < bottom);

  // Reference color = center of the quiet zone (known clear area)
  const refIdx = (sampleRows[1] * width + centerX) * channels;
  const refR = data[refIdx];
  const refG = data[refIdx + 1];
  const refB = data[refIdx + 2];

  // Sweep left from center
  let left = 0;
  for (let x = centerX; x >= 0; x -= COL_STEP) {
    const avg = columnDeviation(data, width, channels, x, sampleRows, refR, refG, refB);
    if (avg > BUSYNESS_THRESHOLD) {
      left = Math.min(x + COL_STEP, centerX);
      break;
    }
  }

  // Sweep right from center
  let right = width;
  for (let x = centerX; x < width; x += COL_STEP) {
    const avg = columnDeviation(data, width, channels, x, sampleRows, refR, refG, refB);
    if (avg > BUSYNESS_THRESHOLD) {
      right = Math.max(x - COL_STEP, centerX);
      break;
    }
  }

  return { left, right };
}

/** Average RGB deviation of a column across sample rows from a reference color */
function columnDeviation(
  data: Buffer,
  width: number,
  channels: number,
  x: number,
  sampleRows: number[],
  refR: number,
  refG: number,
  refB: number
): number {
  let sum = 0;
  for (const y of sampleRows) {
    const idx = (y * width + x) * channels;
    const dr = data[idx] - refR;
    const dg = data[idx + 1] - refG;
    const db = data[idx + 2] - refB;
    sum += Math.sqrt(dr * dr + dg * dg + db * db);
  }
  return sum / sampleRows.length;
}

function stdDev(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / n;
  return Math.sqrt(variance);
}
