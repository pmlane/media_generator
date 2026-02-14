/**
 * Print menu prompt template
 */

import type { MenuContent, BrandProfile } from "../../media/types.js";

export function buildPrintMenuPrompt(
  content: MenuContent,
  brand: BrandProfile
): string {
  const lines: string[] = ["## Menu Content"];

  lines.push(`Title: "${content.title}"`);

  if (content.subtitle) {
    lines.push(`Subtitle: "${content.subtitle}"`);
  }

  lines.push("");

  for (const section of content.sections) {
    lines.push(`### ${section.title}`);
    for (const item of section.items) {
      let itemLine = `- ${item.name}`;
      if (item.price) {
        itemLine += ` — ${item.price}`;
      }
      if (item.description) {
        itemLine += ` (${item.description})`;
      }
      lines.push(itemLine);
    }
    lines.push("");
  }

  if (content.footer) {
    lines.push(`Footer: "${content.footer}"`);
  }

  lines.push("### Menu Design Requirements");
  lines.push("- All item names and prices MUST be legible and correctly spelled");
  lines.push("- Use clear visual hierarchy: title > section headers > items");
  lines.push("- Prices should be right-aligned or clearly associated with their item");
  lines.push("- Section dividers should be subtle but clear");
  lines.push("- Place the attached brand logo prominently at the top of the design");
  lines.push(
    `- Venue: ${brand.venue.address}, ${brand.venue.city}, ${brand.venue.state}`
  );

  return lines.join("\n");
}
