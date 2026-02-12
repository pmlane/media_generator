/**
 * Social media post prompt template
 */

import type { SocialContent, BrandProfile } from "../../media/types.js";

export function buildSocialPostPrompt(
  content: SocialContent,
  brand: BrandProfile
): string {
  const lines: string[] = ["## Social Post Content"];

  lines.push(`Headline: "${content.headline}"`);

  if (content.body) {
    lines.push(`Body text: "${content.body}"`);
  }

  if (content.hashtags?.length) {
    lines.push(`Hashtags: ${content.hashtags.join(" ")}`);
  }

  lines.push("");
  lines.push("### Social Post Design Requirements");
  lines.push("- Headline should be the dominant text element, large and bold");
  lines.push("- Keep the design clean and scroll-stopping");
  lines.push("- Optimize for mobile viewing (text should be readable at small sizes)");
  lines.push(`- Include ${brand.name} logo`);

  if (brand.social.instagram) {
    lines.push(`- Include handle: ${brand.social.instagram}`);
  }

  lines.push("- The image should work as a standalone visual (no caption needed to understand it)");

  return lines.join("\n");
}
