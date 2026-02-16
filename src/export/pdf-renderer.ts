/**
 * Pure PDF renderer
 *
 * Takes a background image buffer + text layout and returns PDF bytes.
 * No file I/O — the exporter handles reading/writing.
 */

import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import type { TextLayout, TextElement } from "../text/layout.js";
import { needsWrapping, wrapText } from "../text/wrap.js";

export interface FontPaths {
  heading: string;
  bodyRegular: string;
  bodyBold: string;
}

/** Parse hex color to pdf-lib rgb() */
function hexToRgb(hex: string): ReturnType<typeof rgb> {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16) / 255;
  const g = parseInt(h.substring(2, 4), 16) / 255;
  const b = parseInt(h.substring(4, 6), 16) / 255;
  return rgb(r, g, b);
}

/**
 * Render a PDF with the background image and editable text elements.
 *
 * @param bgBuffer     Background image bytes (PNG or JPEG)
 * @param bgPath       Original path (used to detect JPEG vs PNG)
 * @param layout       Text layout with pixel coordinates
 * @param fontBytes    Map of font role → font file bytes
 * @param dpi          Image DPI (for px → pt conversion)
 * @returns            PDF file bytes
 */
export async function renderPdf(
  bgBuffer: Buffer,
  bgPath: string,
  layout: TextLayout,
  fontBytes: { heading: Uint8Array; bodyRegular: Uint8Array; bodyBold: Uint8Array },
  dpi: number
): Promise<Uint8Array> {
  const PX_TO_PT = 72 / dpi;
  const pxToPt = (px: number) => px * PX_TO_PT;

  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  // Embed fonts
  const headingFont = await pdfDoc.embedFont(fontBytes.heading);
  const bodyRegular = await pdfDoc.embedFont(fontBytes.bodyRegular);
  const bodyBold = await pdfDoc.embedFont(fontBytes.bodyBold);

  // Page size in points
  const pageWidthPt = pxToPt(layout.width);
  const pageHeightPt = pxToPt(layout.height);
  const page = pdfDoc.addPage([pageWidthPt, pageHeightPt]);

  // Embed background image
  const isJpeg = /\.jpe?g$/i.test(bgPath);
  const bgImage = isJpeg
    ? await pdfDoc.embedJpg(bgBuffer)
    : await pdfDoc.embedPng(bgBuffer);

  page.drawImage(bgImage, {
    x: 0,
    y: 0,
    width: pageWidthPt,
    height: pageHeightPt,
  });

  // Resolve the right embedded font for a given element
  function resolveFont(el: TextElement) {
    const family = el.fontFamily.toLowerCase();
    if (family === "oswald") return headingFont;
    if (el.fontWeight === "bold") return bodyBold;
    return bodyRegular;
  }

  // Draw text elements
  for (const el of layout.elements) {
    const font = resolveFont(el);
    const color = hexToRgb(el.color);
    const fontSizePt = pxToPt(el.fontSize);

    const lines =
      el.maxWidth && needsWrapping(el.text, el.fontSize, el.maxWidth)
        ? wrapText(el.text, el.fontSize, el.maxWidth)
        : [el.text];

    const lineHeightPx = Math.round(el.fontSize * 1.3);

    for (let i = 0; i < lines.length; i++) {
      const lineText = lines[i];
      const textWidth = font.widthOfTextAtSize(lineText, fontSizePt);

      // Convert pixel y (top-left origin) to PDF y (bottom-left origin)
      const yPx = el.y + i * lineHeightPx;
      const yPt = pageHeightPt - pxToPt(yPx);

      // Compute x based on anchor
      let xPt: number;
      if (el.anchor === "middle") {
        xPt = pxToPt(el.x) - textWidth / 2;
      } else if (el.anchor === "end") {
        xPt = pxToPt(el.x) - textWidth;
      } else {
        xPt = pxToPt(el.x);
      }

      page.drawText(lineText, {
        x: xPt,
        y: yPt,
        size: fontSizePt,
        font,
        color,
      });
    }
  }

  return pdfDoc.save();
}
