/**
 * Background-only print menu prompt template
 *
 * Used with --text-overlay mode. Tells the AI to generate a decorative
 * background design with NO text — text is composited programmatically.
 */

import type { MenuContent, BrandProfile } from "../../media/types.js";

export function buildPrintMenuBackgroundPrompt(
  content: MenuContent,
  brand: BrandProfile
): string {
  const lines: string[] = ["## Background Design (NO TEXT)"];

  lines.push(
    "Create a decorative background image for a printed menu. This image will have text added programmatically afterward, so you MUST NOT include any text in the image."
  );

  lines.push("");
  lines.push("### Design Requirements");
  lines.push("- Create an elegant, themed decorative border/frame");
  lines.push("- Leave the CENTER AREA mostly clear for text overlay");
  lines.push("- Include themed design elements appropriate to the menu");
  lines.push("- Use the brand color palette for all decorative elements");
  lines.push("- Design should complement the brand's visual identity");

  // Give thematic hints from the menu content without asking it to render text
  if (content.tags?.length) {
    lines.push(`\n### Theme: ${content.tags.join(", ")}`);
    lines.push("Incorporate visual elements that evoke this theme (decorative motifs, patterns, relevant imagery) — but NO text.");
  }

  lines.push("");
  lines.push("### Layout Zones (approximate)");
  lines.push("- Top 20-30%: Decorative header area with logo placement zone");
  lines.push("- Center 50-60%: KEEP CLEAR — minimal decoration, this is where menu text will be overlaid");
  lines.push("- Bottom 10-15%: Decorative footer area with subtle border elements");

  lines.push("");
  lines.push("### CRITICAL RULES");
  lines.push("- DO NOT render any text, words, letters, numbers, or prices");
  lines.push("- DO NOT write menu item names, section headers, or titles");
  lines.push("- DO NOT include any handwritten or decorative text");
  lines.push("- The center area must be clean enough for overlaid text to be legible");
  lines.push(
    `- Venue: ${brand.venue.address}, ${brand.venue.city}, ${brand.venue.state} (for atmosphere reference only — do NOT render this text)`
  );

  return lines.join("\n");
}
