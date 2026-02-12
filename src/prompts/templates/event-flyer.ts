/**
 * Event flyer prompt template
 */

import type { EventContent, BrandProfile } from "../../media/types.js";

export function buildEventFlyerPrompt(
  content: EventContent,
  brand: BrandProfile
): string {
  const lines: string[] = ["## Event Details"];

  lines.push(`Event: "${content.eventName}"`);
  lines.push(`Date: ${content.date}`);

  if (content.time) {
    lines.push(`Time: ${content.time}`);
  }

  if (content.description) {
    lines.push(`Description: ${content.description}`);
  }

  // Venue info from brand
  lines.push("");
  lines.push("### Venue Information");
  lines.push(`Venue: ${brand.name}`);
  lines.push(
    `Address: ${brand.venue.address}, ${brand.venue.city}, ${brand.venue.state} ${brand.venue.zip}`
  );

  if (brand.social.instagram) {
    lines.push(`Instagram: ${brand.social.instagram}`);
  }

  lines.push("");
  lines.push("### Flyer Requirements");
  lines.push("- Event name should be the most prominent text element");
  lines.push("- Date and time must be clearly visible");
  lines.push("- Include venue name and address");
  lines.push("- Include social media handle if provided");
  lines.push("- Create visual hierarchy: event name > date/time > venue > details");

  return lines.join("\n");
}
