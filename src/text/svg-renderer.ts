/**
 * SVG text renderer
 *
 * Converts a TextLayout into an SVG string for compositing with Sharp.
 * Uses brand fonts via font-family. Handles word wrapping for long text
 * via <tspan> elements.
 */

import type { TextLayout, TextElement } from "./layout.js";

/** Approximate character width as fraction of font size (monospace-ish estimate) */
const CHAR_WIDTH_RATIO = 0.55;

/**
 * Render a TextLayout as an SVG string
 */
export function renderTextSvg(layout: TextLayout): Buffer {
  const svgElements: string[] = [];

  for (const el of layout.elements) {
    svgElements.push(renderElement(el));
  }

  const svg = `<svg width="${layout.width}" height="${layout.height}" xmlns="http://www.w3.org/2000/svg">
  ${svgElements.join("\n  ")}
</svg>`;

  return Buffer.from(svg);
}

function renderElement(el: TextElement): string {
  const style = [
    `font-family: '${el.fontFamily}', sans-serif`,
    `font-size: ${el.fontSize}px`,
    `font-weight: ${el.fontWeight}`,
    `fill: ${el.color}`,
  ].join("; ");

  const anchor =
    el.anchor === "middle"
      ? "middle"
      : el.anchor === "end"
        ? "end"
        : "start";

  // Check if wrapping is needed
  if (el.maxWidth && needsWrapping(el.text, el.fontSize, el.maxWidth)) {
    return renderWrappedText(el, style, anchor);
  }

  const escaped = escapeXml(el.text);
  return `<text x="${el.x}" y="${el.y}" text-anchor="${anchor}" style="${style}">${escaped}</text>`;
}

function renderWrappedText(
  el: TextElement,
  style: string,
  anchor: string
): string {
  const lines = wrapText(el.text, el.fontSize, el.maxWidth!);
  const lineHeight = Math.round(el.fontSize * 1.3);

  const tspans = lines
    .map((line, i) => {
      const dy = i === 0 ? 0 : lineHeight;
      return `<tspan x="${el.x}" dy="${dy}">${escapeXml(line)}</tspan>`;
    })
    .join("");

  return `<text x="${el.x}" y="${el.y}" text-anchor="${anchor}" style="${style}">${tspans}</text>`;
}

function needsWrapping(text: string, fontSize: number, maxWidth: number): boolean {
  const estimatedWidth = text.length * fontSize * CHAR_WIDTH_RATIO;
  return estimatedWidth > maxWidth;
}

function wrapText(text: string, fontSize: number, maxWidth: number): string[] {
  const charWidth = fontSize * CHAR_WIDTH_RATIO;
  const maxChars = Math.floor(maxWidth / charWidth);

  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (testLine.length > maxChars && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
