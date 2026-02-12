/**
 * Output format constants for social media and print
 */

import type { FormatConfig } from "./types.js";

// --- Social Media Formats (RGB, 72 DPI, PNG/JPEG) ---

export const INSTAGRAM_SQUARE: FormatConfig = {
  name: "INSTAGRAM_SQUARE",
  label: "Instagram Square",
  width: 1080,
  height: 1080,
  aspectRatio: "1:1",
  dpi: 72,
  category: "social",
};

export const STORY: FormatConfig = {
  name: "STORY",
  label: "Story (IG/FB)",
  width: 1080,
  height: 1920,
  aspectRatio: "9:16",
  dpi: 72,
  category: "social",
};

export const FACEBOOK: FormatConfig = {
  name: "FACEBOOK",
  label: "Facebook Post",
  width: 1200,
  height: 630,
  aspectRatio: "16:9",
  dpi: 72,
  category: "social",
};

export const TWITTER: FormatConfig = {
  name: "TWITTER",
  label: "Twitter/X Post",
  width: 1200,
  height: 675,
  aspectRatio: "16:9",
  dpi: 72,
  category: "social",
};

// --- Print Formats (300 DPI, with bleed and safe margins) ---
// Bleed: 0.125" = 38px @300dpi on each side
// Safe margin: 0.25" = 75px @300dpi inset from trim

const PRINT_BLEED = 38;
const PRINT_SAFE_MARGIN = 75;

export const LETTER_PORTRAIT: FormatConfig = {
  name: "LETTER_PORTRAIT",
  label: "Letter Portrait (8.5x11)",
  width: 2550,
  height: 3300,
  aspectRatio: "17:22",
  dpi: 300,
  category: "print",
  bleed: PRINT_BLEED,
  safeMargin: PRINT_SAFE_MARGIN,
};

export const LETTER_LANDSCAPE: FormatConfig = {
  name: "LETTER_LANDSCAPE",
  label: "Letter Landscape (11x8.5)",
  width: 3300,
  height: 2550,
  aspectRatio: "22:17",
  dpi: 300,
  category: "print",
  bleed: PRINT_BLEED,
  safeMargin: PRINT_SAFE_MARGIN,
};

export const HALF_LETTER: FormatConfig = {
  name: "HALF_LETTER",
  label: "Half Letter (5.5x8.5)",
  width: 1650,
  height: 2550,
  aspectRatio: "11:17",
  dpi: 300,
  category: "print",
  bleed: PRINT_BLEED,
  safeMargin: PRINT_SAFE_MARGIN,
};

export const LEGAL: FormatConfig = {
  name: "LEGAL",
  label: "Legal (8.5x14)",
  width: 2550,
  height: 4200,
  aspectRatio: "17:28",
  dpi: 300,
  category: "print",
  bleed: PRINT_BLEED,
  safeMargin: PRINT_SAFE_MARGIN,
};

export const A4: FormatConfig = {
  name: "A4",
  label: "A4 (210x297mm)",
  width: 2480,
  height: 3508,
  aspectRatio: "210:297",
  dpi: 300,
  category: "print",
  bleed: PRINT_BLEED,
  safeMargin: PRINT_SAFE_MARGIN,
};

// --- Format Registry ---

export const SOCIAL_FORMATS: Record<string, FormatConfig> = {
  instagram: INSTAGRAM_SQUARE,
  story: STORY,
  facebook: FACEBOOK,
  twitter: TWITTER,
};

export const PRINT_FORMATS: Record<string, FormatConfig> = {
  "letter-portrait": LETTER_PORTRAIT,
  "letter-landscape": LETTER_LANDSCAPE,
  "half-letter": HALF_LETTER,
  legal: LEGAL,
  a4: A4,
};

export const ALL_FORMATS: Record<string, FormatConfig> = {
  ...SOCIAL_FORMATS,
  ...PRINT_FORMATS,
};

/**
 * Resolve format names to FormatConfig objects.
 * Accepts lowercase aliases (e.g. "instagram", "letter-portrait").
 */
export function resolveFormats(names: string[]): FormatConfig[] {
  return names.map((name) => {
    const key = name.toLowerCase();
    const format = ALL_FORMATS[key];
    if (!format) {
      const available = Object.keys(ALL_FORMATS).join(", ");
      throw new Error(
        `Unknown format "${name}". Available formats: ${available}`
      );
    }
    return format;
  });
}

/**
 * Create a custom print format with given dimensions in inches.
 */
export function customPrintFormat(
  label: string,
  widthInches: number,
  heightInches: number
): FormatConfig {
  const dpi = 300;
  return {
    name: "CUSTOM",
    label,
    width: Math.round(widthInches * dpi),
    height: Math.round(heightInches * dpi),
    aspectRatio: `${widthInches}:${heightInches}`,
    dpi,
    category: "print",
    bleed: PRINT_BLEED,
    safeMargin: PRINT_SAFE_MARGIN,
  };
}
