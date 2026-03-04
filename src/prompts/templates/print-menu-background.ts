/**
 * Background-only print menu prompt template
 *
 * Used with --text-overlay mode. Tells the AI to generate a decorative
 * background design with NO text — text is composited programmatically.
 * When brand assets are attached, instructs AI to integrate the logo.
 */

import type { MenuContent, BrandProfile } from "../../media/types.js";

export function buildPrintMenuBackgroundPrompt(
  content: MenuContent,
  brand: BrandProfile,
  hasBrandAssets?: boolean
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
  if (hasBrandAssets) {
    lines.push("- Top 20-30%: Header area — incorporate the attached brand logo here as a prominent design element. Frame it with decorative elements that match the overall style. The logo should look like a natural, intentional part of the composition.");
  } else {
    lines.push("- Top 20-30%: Header area — decorative header with brand-inspired design elements");
  }
  lines.push("- Center 50-60%: KEEP CLEAR — minimal decoration, this is where menu text will be overlaid");
  lines.push("- Bottom 10-15%: Decorative footer area with subtle border elements");

  lines.push("");
  lines.push("### CRITICAL RULES");
  lines.push("- DO NOT render any menu text: no item names, prices, section headers, or titles");
  lines.push("- DO NOT include any handwritten, decorative, or filler text");
  if (hasBrandAssets) {
    lines.push("- The attached brand logo is the ONLY image element to include — use it exactly as provided in the header area. Do not redraw, trace, or recreate it. Add framing, borders, or decorative accents around it that complement the design style.");
  }
  lines.push("- The center area must be clean enough for overlaid text to be legible");
  lines.push(
    `- Venue: ${brand.venue.address}, ${brand.venue.city}, ${brand.venue.state} (for atmosphere reference only — do NOT render this text)`
  );

  return lines.join("\n");
}
