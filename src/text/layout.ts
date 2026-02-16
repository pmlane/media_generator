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
import type { ClearZone } from "./measure.js";

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

/** Approximate character width as fraction of font size (matches SVG renderer) */
const CHAR_WIDTH_RATIO = 0.55;

/** Estimate how many lines text will wrap to at a given font size and max width */
function estimateLines(text: string, fontSize: number, maxWidth: number): number {
  const charWidth = fontSize * CHAR_WIDTH_RATIO;
  const maxChars = Math.floor(maxWidth / charWidth);
  if (maxChars <= 0) return 1;
  return Math.ceil(text.length / maxChars);
}

export interface MenuLayoutOptions {
  accentColor?: string;
  headingFont?: string;
  bodyFont?: string;
}

/**
 * Calculate text layout for a menu on a given format.
 *
 * When a ClearZone is provided (from background analysis), it positions
 * text within the measured quiet area. Otherwise falls back to hardcoded
 * zone estimates.
 *
 * Coordinates are on the full canvas (trim + bleed) so the resulting SVG
 * can be composited directly onto the post-processed image.
 */
export function calculateMenuLayout(
  content: MenuContent,
  brand: BrandProfile,
  format: FormatConfig,
  clearZone?: ClearZone,
  options?: MenuLayoutOptions
): TextLayout {
  const bleed = format.bleed ?? 0;
  const safeMargin = format.safeMargin ?? 75;
  const dpi = format.dpi;

  // Full canvas dimensions (what the processed image actually is)
  const canvasWidth = format.width + bleed * 2;
  const canvasHeight = format.height + bleed * 2;

  // Inner padding from the clear zone edges (breathing room)
  const innerPadding = ptToPx(12, dpi);
  // Extra top padding to clear AI-rendered logo text that may extend
  // below the measured quiet zone boundary
  const topPadding = ptToPx(24, dpi);

  // Content area — use measured clear zone or fall back to safe margin
  const contentLeft = clearZone
    ? clearZone.left + innerPadding
    : bleed + safeMargin;
  const contentRight = clearZone
    ? clearZone.right - innerPadding
    : canvasWidth - bleed - safeMargin;
  const contentWidth = contentRight - contentLeft;
  const centerX = Math.round((contentLeft + contentRight) / 2);

  // Price right-edge padding to prevent clipping
  const priceRightPadding = ptToPx(7, dpi);

  // Zone boundaries — use measured clear zone or hardcoded estimates
  const titleZoneTop = clearZone
    ? clearZone.top + topPadding
    : bleed + Math.round(format.height * 0.30);
  const footerZoneBottom = clearZone
    ? clearZone.bottom
    : canvasHeight - bleed - safeMargin;
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

  // Base font sizes in points (professional print range)
  const baseTitlePt = 28;
  const baseSectionPt = 16;
  const baseItemPt = 11;
  const baseDescPt = 9;
  const baseFooterPt = 8;
  const baseSubtitlePt = 12;

  // Width-aware scaling: narrow content areas (e.g., bordered backgrounds)
  // need proportionally smaller fonts to avoid excessive word wrapping.
  // Nominal column width assumes ~70% of canvas is usable text area.
  const nominalWidth = canvasWidth * 0.7;
  const widthScale =
    contentWidth < nominalWidth
      ? Math.sqrt(contentWidth / nominalWidth)
      : 1;

  // Estimate needed height and scale down if overflow
  // Account for description gaps (extra 0.5× desc size per described item)
  const descItemCount = hasDescriptions
    ? content.sections.reduce(
        (sum, s) => sum + s.items.filter((i) => i.description).length,
        0
      )
    : 0;
  const itemHeightPt = hasDescriptions ? 34 : 20;
  const descGapPt = 5; // extra gap after descriptions
  const sectionHeightPt = 26;
  const titleHeightPt = 44 + (content.subtitle ? 20 : 0);
  const neededPx = ptToPx(
    titleHeightPt +
      totalItems * itemHeightPt +
      descItemCount * descGapPt +
      totalSections * sectionHeightPt,
    dpi
  );
  const heightScale = Math.min(1, menuZoneHeight / neededPx);
  let scale = Math.min(heightScale, widthScale);

  const headingFont = options?.headingFont ?? brand.typography.heading;
  const bodyFont = options?.bodyFont ?? brand.typography.body;
  const headingColor = options?.accentColor ?? brand.colors.primary;
  const darkColor = brand.colors.dark;
  const descriptionColor = "#555555";
  const narrowMode = widthScale < 1;

  // Build layout with overflow retry — the initial height estimate doesn't
  // account for text wrapping in narrow columns, so we may need to shrink.
  let elements: TextElement[] = [];
  for (let attempt = 0; attempt < 3; attempt++) {
    elements = [];

    const titleSize = ptToPx(Math.max(20, baseTitlePt * scale), dpi);
    const subtitleSize = ptToPx(Math.max(9, baseSubtitlePt * scale), dpi);
    const sectionHeaderSize = ptToPx(Math.max(12, baseSectionPt * scale), dpi);
    const itemNameSize = ptToPx(Math.max(8, baseItemPt * scale), dpi);
    const itemDescSize = ptToPx(Math.max(7, baseDescPt * scale), dpi);
    const footerSize = ptToPx(Math.max(6, baseFooterPt * scale), dpi);

    // --- Title ---
    let y = titleZoneTop + titleSize;
    elements.push({
      text: content.title,
      x: centerX,
      y,
      fontSize: titleSize,
      fontFamily: headingFont,
      fontWeight: "bold",
      color: headingColor,
      anchor: "middle",
      maxWidth: contentWidth,
    });
    const titleLines = estimateLines(content.title, titleSize, contentWidth);
    if (titleLines > 1) {
      y += Math.round(titleSize * 1.3) * (titleLines - 1);
    }

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
        color: descriptionColor,
        anchor: "middle",
        maxWidth: contentWidth,
      });
    }

    // --- Menu items ---
    const lineSpacing = Math.round(itemNameSize * 1.8);
    const descLineSpacing = Math.round(itemDescSize * 1.5);
    const sectionGap = Math.round(sectionHeaderSize * 2.2);
    const postHeaderGap = Math.round(sectionHeaderSize * 0.6);

    y += Math.round(titleSize * 0.4);

    for (const section of content.sections) {
      const skipHeader =
        content.sections.length === 1 &&
        section.title.toLowerCase() === content.title.toLowerCase();

      if (!skipHeader) {
        y += sectionGap;
        const headerText = section.title.toUpperCase();
        elements.push({
          text: headerText,
          x: centerX,
          y,
          fontSize: sectionHeaderSize,
          fontFamily: headingFont,
          fontWeight: "bold",
          color: headingColor,
          anchor: "middle",
          maxWidth: contentWidth,
        });
        const headerLines = estimateLines(headerText, sectionHeaderSize, contentWidth);
        if (headerLines > 1) {
          y += Math.round(sectionHeaderSize * 1.3) * (headerLines - 1);
        }
        y += postHeaderGap;
      }

      for (const item of section.items) {
        y += lineSpacing;

        if (narrowMode) {
          const displayText = item.price
            ? `${item.name}  ·  ${item.price}`
            : item.name;
          elements.push({
            text: displayText,
            x: centerX,
            y,
            fontSize: itemNameSize,
            fontFamily: bodyFont,
            fontWeight: "bold",
            color: darkColor,
            anchor: "middle",
            maxWidth: contentWidth,
          });

          const displayLines = estimateLines(displayText, itemNameSize, contentWidth);
          if (displayLines > 1) {
            y += Math.round(itemNameSize * 1.3) * (displayLines - 1);
          }

          if (item.description) {
            y += descLineSpacing;
            elements.push({
              text: item.description,
              x: centerX,
              y,
              fontSize: itemDescSize,
              fontFamily: bodyFont,
              fontWeight: "normal",
              color: descriptionColor,
              anchor: "middle",
              maxWidth: contentWidth,
            });
            const descLines = estimateLines(item.description, itemDescSize, contentWidth);
            if (descLines > 1) {
              y += Math.round(itemDescSize * 1.3) * (descLines - 1);
            }
            y += Math.round(itemDescSize * 0.5);
          }
        } else {
          const nameMaxWidth = item.price ? contentWidth * 0.75 : contentWidth;
          elements.push({
            text: item.name,
            x: contentLeft,
            y,
            fontSize: itemNameSize,
            fontFamily: bodyFont,
            fontWeight: "bold",
            color: darkColor,
            anchor: "start",
            maxWidth: nameMaxWidth,
          });

          if (item.price) {
            elements.push({
              text: item.price,
              x: contentRight - priceRightPadding,
              y,
              fontSize: itemNameSize,
              fontFamily: bodyFont,
              fontWeight: "normal",
              color: darkColor,
              anchor: "end",
            });
          }

          const nameLines = estimateLines(item.name, itemNameSize, nameMaxWidth);
          if (nameLines > 1) {
            y += Math.round(itemNameSize * 1.3) * (nameLines - 1);
          }

          if (item.description) {
            y += descLineSpacing;
            elements.push({
              text: item.description,
              x: contentLeft,
              y,
              fontSize: itemDescSize,
              fontFamily: bodyFont,
              fontWeight: "normal",
              color: descriptionColor,
              anchor: "start",
              maxWidth: contentWidth,
            });
            y += Math.round(itemDescSize * 0.5);
          }
        }
      }
    }

    // Check for overflow — if last menu element exceeds the zone, shrink and retry
    if (y > menuZoneBottom) {
      scale *= menuZoneBottom / y;
      continue;
    }
    break;
  }

  // --- Footer ---
  const footerSize = ptToPx(Math.max(6, baseFooterPt * scale), dpi);
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
