/**
 * Text layout engine for menu overlays
 *
 * Calculates pixel positions for menu items on a given format.
 * Handles title, sections, items (name + price + description), footer zones.
 *
 * All coordinates are in pixels on the FINAL canvas (trim + bleed).
 * Font sizes are in pixels at the format's DPI.
 */

import type { MenuContent, BrandProfile, FormatConfig } from "../media/types.js";

// --- Layout types ---

export interface TextElement {
  text: string;
  x: number;
  y: number;
  fontSize: number;
  fontFamily: string;
  fontWeight: "normal" | "bold";
  color: string;
  anchor: "start" | "middle" | "end";
  maxWidth?: number;
}

export interface TextLayout {
  width: number;
  height: number;
  elements: TextElement[];
}

/** Convert typographic points to pixels at a given DPI */
function ptToPx(pt: number, dpi: number): number {
  return Math.round((pt * dpi) / 72);
}

/**
 * Calculate text layout for a menu on a given format.
 *
 * Coordinates are on the full canvas (trim + bleed) so the resulting SVG
 * can be composited directly onto the post-processed image.
 */
export function calculateMenuLayout(
  content: MenuContent,
  brand: BrandProfile,
  format: FormatConfig
): TextLayout {
  const bleed = format.bleed ?? 0;
  const safeMargin = format.safeMargin ?? 75;
  const dpi = format.dpi;

  // Full canvas dimensions (what the processed image actually is)
  const canvasWidth = format.width + bleed * 2;
  const canvasHeight = format.height + bleed * 2;

  // Content area (safe margin measured from trim edge, which starts at bleed)
  const contentLeft = bleed + safeMargin;
  const contentRight = canvasWidth - bleed - safeMargin;
  const contentWidth = contentRight - contentLeft;
  const centerX = canvasWidth / 2;

  // Zone boundaries (relative to canvas top)
  // Logo occupies roughly the top 25-30% of the design
  const logoZoneBottom = bleed + Math.round(format.height * 0.30);
  const titleZoneTop = logoZoneBottom;
  const footerZoneBottom = canvasHeight - bleed - safeMargin;
  const footerHeight = ptToPx(12, dpi);
  const footerZoneTop = footerZoneBottom - footerHeight * 2;
  const menuZoneTop = titleZoneTop;
  const menuZoneBottom = footerZoneTop - ptToPx(8, dpi);
  const menuZoneHeight = menuZoneBottom - menuZoneTop;

  // Count items to determine sizing
  const totalItems = content.sections.reduce(
    (sum, s) => sum + s.items.length,
    0
  );
  const totalSections = content.sections.length;
  const hasDescriptions = content.sections.some((s) =>
    s.items.some((i) => i.description)
  );

  // Base font sizes in points, then convert to pixels at DPI
  const baseTitlePt = 36;
  const baseSectionPt = 20;
  const baseItemPt = 14;
  const baseDescPt = 10;
  const baseFooterPt = 9;
  const baseSubtitlePt = 14;

  // Estimate needed height and scale down if overflow
  const itemHeightPt = hasDescriptions ? 38 : 22;
  const sectionHeightPt = 30;
  const titleHeightPt = 50 + (content.subtitle ? 24 : 0);
  const neededPx = ptToPx(
    titleHeightPt + totalItems * itemHeightPt + totalSections * sectionHeightPt,
    dpi
  );
  const scale = Math.min(1, menuZoneHeight / neededPx);

  const titleSize = ptToPx(Math.max(24, baseTitlePt * scale), dpi);
  const subtitleSize = ptToPx(Math.max(10, baseSubtitlePt * scale), dpi);
  const sectionHeaderSize = ptToPx(Math.max(14, baseSectionPt * scale), dpi);
  const itemNameSize = ptToPx(Math.max(10, baseItemPt * scale), dpi);
  const itemDescSize = ptToPx(Math.max(8, baseDescPt * scale), dpi);
  const footerSize = ptToPx(Math.max(7, baseFooterPt * scale), dpi);

  const headingFont = brand.typography.heading;
  const bodyFont = brand.typography.body;
  const primaryColor = brand.colors.primary;
  const darkColor = brand.colors.dark;
  const secondaryColor = brand.colors.secondary ?? brand.colors.accent;

  const elements: TextElement[] = [];

  // --- Title ---
  let y = titleZoneTop + titleSize;
  elements.push({
    text: content.title,
    x: centerX,
    y,
    fontSize: titleSize,
    fontFamily: headingFont,
    fontWeight: "bold",
    color: primaryColor,
    anchor: "middle",
    maxWidth: contentWidth,
  });

  // --- Subtitle ---
  if (content.subtitle) {
    y += Math.round(subtitleSize * 1.4);
    elements.push({
      text: content.subtitle,
      x: centerX,
      y,
      fontSize: subtitleSize,
      fontFamily: bodyFont,
      fontWeight: "normal",
      color: secondaryColor,
      anchor: "middle",
      maxWidth: contentWidth,
    });
  }

  // --- Menu items ---
  const lineSpacing = Math.round(itemNameSize * 1.8);
  const descLineSpacing = Math.round(itemDescSize * 1.5);
  const sectionGap = Math.round(sectionHeaderSize * 2.2);
  const postHeaderGap = Math.round(sectionHeaderSize * 0.6);

  // Start menu items after title/subtitle with some padding
  y += Math.round(titleSize * 0.4);

  for (const section of content.sections) {
    // Skip section header if it duplicates the menu title (single-section menus)
    const skipHeader =
      content.sections.length === 1 &&
      section.title.toLowerCase() === content.title.toLowerCase();

    if (!skipHeader) {
      y += sectionGap;
      elements.push({
        text: section.title.toUpperCase(),
        x: centerX,
        y,
        fontSize: sectionHeaderSize,
        fontFamily: headingFont,
        fontWeight: "bold",
        color: primaryColor,
        anchor: "middle",
        maxWidth: contentWidth,
      });
      y += postHeaderGap;
    }

    // Items
    for (const item of section.items) {
      y += lineSpacing;

      // Item name (left-aligned)
      elements.push({
        text: item.name,
        x: contentLeft,
        y,
        fontSize: itemNameSize,
        fontFamily: bodyFont,
        fontWeight: "bold",
        color: darkColor,
        anchor: "start",
        maxWidth: item.price ? contentWidth * 0.75 : contentWidth,
      });

      // Price (right-aligned, same line)
      if (item.price) {
        elements.push({
          text: item.price,
          x: contentRight,
          y,
          fontSize: itemNameSize,
          fontFamily: bodyFont,
          fontWeight: "normal",
          color: darkColor,
          anchor: "end",
        });
      }

      // Description (below name, lighter color)
      if (item.description) {
        y += descLineSpacing;
        elements.push({
          text: item.description,
          x: contentLeft,
          y,
          fontSize: itemDescSize,
          fontFamily: bodyFont,
          fontWeight: "normal",
          color: secondaryColor,
          anchor: "start",
          maxWidth: contentWidth,
        });
      }
    }
  }

  // --- Footer ---
  if (content.footer) {
    elements.push({
      text: content.footer,
      x: centerX,
      y: footerZoneTop + footerSize,
      fontSize: footerSize,
      fontFamily: bodyFont,
      fontWeight: "normal",
      color: darkColor,
      anchor: "middle",
      maxWidth: contentWidth,
    });
  }

  return { width: canvasWidth, height: canvasHeight, elements };
}
