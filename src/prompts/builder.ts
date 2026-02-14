/**
 * Prompt builder
 *
 * Assembles brand context + content + format specs into a generation prompt.
 * Injects design rules, safe margins, brand voice.
 */

import type {
  BrandProfile,
  FormatConfig,
  MediaType,
  FlyerStyle,
  EventContent,
  MenuContent,
  SocialContent,
  ContentData,
} from "../media/types.js";
import { buildEventFlyerPrompt } from "./templates/event-flyer.js";
import { buildPrintMenuPrompt } from "./templates/print-menu.js";
import { buildPrintMenuBackgroundPrompt } from "./templates/print-menu-background.js";
import { buildSocialPostPrompt } from "./templates/social-post.js";

export const STYLE_DESCRIPTIONS: Record<FlyerStyle, string> = {
  vibrant: "colorful and energetic with bold contrasts",
  minimal: "clean and modern with elegant typography and lots of whitespace",
  retro: "vintage pub aesthetic with warm tones and classic typography",
  neon: "neon signs on dark background with glowing effects",
};

export interface PromptContext {
  brand: BrandProfile;
  format: FormatConfig;
  mediaType: MediaType;
  content: ContentData;
  style?: FlyerStyle;
  customPrompt?: string;
  hasTemplateImage?: boolean;
  hasBrandAssets?: boolean;
  hasContentImages?: boolean;
  preferredBackground?: "light" | "dark";
  textOverlay?: boolean;
}

/**
 * Build the full generation prompt for a given context
 */
export function buildPrompt(ctx: PromptContext): string {
  const sections: string[] = [];

  // 1. Role and task
  sections.push(buildRoleSection(ctx));

  // 2. Brand identity
  sections.push(buildBrandSection(ctx.brand));

  // 3. Content-specific prompt
  sections.push(buildContentSection(ctx));

  // 4. Format specifications
  sections.push(buildFormatSection(ctx.format));

  // 5. Design rules
  sections.push(buildDesignRulesSection(ctx.brand));

  // 6. Image context (brand logos, template, content images)
  if (ctx.hasBrandAssets || ctx.hasTemplateImage || ctx.hasContentImages) {
    sections.push(buildImageContextSection(ctx));
  }

  // 7. Custom instructions (last, highest priority)
  if (ctx.customPrompt) {
    sections.push(`## Additional Instructions\n${ctx.customPrompt}`);
  }

  return sections.join("\n\n");
}

function buildRoleSection(ctx: PromptContext): string {
  const styleDesc = ctx.style
    ? STYLE_DESCRIPTIONS[ctx.style]
    : "professional and on-brand";

  const typeLabel =
    ctx.mediaType === "event-flyer"
      ? "event flyer"
      : ctx.mediaType === "print-menu"
        ? "print menu"
        : "social media post";

  return `You are a professional graphic designer creating a ${styleDesc} ${typeLabel} for ${ctx.brand.name}.

Generate a single high-quality image. All text must be legible, correctly spelled, and properly laid out.`;
}

function buildBrandSection(brand: BrandProfile): string {
  const colorList = Object.entries(brand.colors)
    .map(([name, hex]) => `  - ${name}: ${hex}`)
    .join("\n");

  return `## Brand Identity: ${brand.name}
Tagline: "${brand.tagline}"

### Colors (use as dominant palette)
${colorList}

### Typography
- Headings: ${brand.typography.heading} (min ${brand.typography.min_heading_size}pt)
- Body: ${brand.typography.body} (min ${brand.typography.min_body_size}pt)
- Accent: ${brand.typography.accent}

### Voice & Tone
${brand.voice.tone}. ${brand.voice.personality}
Writing style: ${brand.voice.writing_style}`;
}

function buildContentSection(ctx: PromptContext): string {
  switch (ctx.mediaType) {
    case "event-flyer":
      return buildEventFlyerPrompt(ctx.content as EventContent, ctx.brand);
    case "print-menu":
      if (ctx.textOverlay) {
        return buildPrintMenuBackgroundPrompt(ctx.content as MenuContent, ctx.brand);
      }
      return buildPrintMenuPrompt(ctx.content as MenuContent, ctx.brand);
    case "social-post":
      return buildSocialPostPrompt(ctx.content as SocialContent, ctx.brand);
  }
}

function buildFormatSection(format: FormatConfig): string {
  let section = `## Output Format
- Name: ${format.label}
- Dimensions: ${format.width}x${format.height} pixels
- Aspect ratio: ${format.aspectRatio}
- DPI: ${format.dpi}`;

  if (format.category === "print") {
    section += `
- Category: Print (high resolution)
- Bleed: ${format.bleed}px on each side
- Safe margin: ${format.safeMargin}px inset from trim edge
- Keep all text and critical elements within the safe margin`;
  } else {
    section += `
- Category: Social media (screen resolution)`;
  }

  return section;
}

function buildDesignRulesSection(brand: BrandProfile): string {
  const prohibited = brand.design_rules.prohibited
    .map((r) => `- ${r}`)
    .join("\n");
  const required = brand.design_rules.required
    .map((r) => `- ${r}`)
    .join("\n");

  return `## Design Rules (MUST follow)
Logo clearspace: ${brand.design_rules.logo_clearspace}
Safe margins: ${brand.design_rules.safe_margins}

### Prohibited
${prohibited}

### Required
${required}`;
}

function buildImageContextSection(ctx: PromptContext): string {
  const lines: string[] = ["## Attached Images"];

  if (ctx.hasBrandAssets) {
    lines.push(
      "- **Brand logo**: The brand's logo. Place it prominently in the design (typically at the top), sized appropriately. Do not recreate or redraw the logo; use the attached image exactly as provided."
    );
  }

  if (ctx.hasTemplateImage) {
    lines.push(
      "- **Template image**: Recreate this exact visual design but with the new content provided above. Match the layout, style, and composition."
    );
  }

  if (ctx.hasContentImages) {
    lines.push(
      "- **Content images**: One-off images relevant to this specific piece. Incorporate them naturally into the design."
    );
  }

  return lines.join("\n");
}
