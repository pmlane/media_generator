/**
 * Shared text wrapping utilities
 *
 * Used by both the SVG renderer (for compositing) and the PDF renderer
 * (for editable text export). Keeps wrapping logic in one place.
 */

/** Approximate character width as fraction of font size (monospace-ish estimate) */
export const CHAR_WIDTH_RATIO = 0.55;

export function needsWrapping(text: string, fontSize: number, maxWidth: number): boolean {
  return text.length * fontSize * CHAR_WIDTH_RATIO > maxWidth;
}

export function wrapText(text: string, fontSize: number, maxWidth: number): string[] {
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
  if (currentLine) lines.push(currentLine);
  return lines;
}
