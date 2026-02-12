/**
 * Zod validation schemas for brand profiles
 */

import { z } from "zod";

const hexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Must be a hex color");

export const brandLogoSchema = z.object({
  id: z.string().min(1),
  path: z.string().min(1),
  resolvedPath: z.string().optional(),
  type: z.enum(["primary", "secondary", "mascot", "icon"]),
  use_on: z.enum(["light", "dark", "any"]).optional(),
});

export const brandAssetSchema = z.object({
  id: z.string().min(1),
  path: z.string().min(1),
  resolvedPath: z.string().optional(),
  type: z.enum(["background", "texture", "watermark", "decoration"]),
  description: z.string().optional(),
});

export const brandProfileSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  tagline: z.string(),

  venue: z.object({
    address: z.string(),
    city: z.string(),
    state: z.string(),
    zip: z.string(),
    phone: z.string(),
    email: z.string().email(),
    hours_note: z.string().optional(),
  }),

  social: z.object({
    instagram: z.string().optional(),
    facebook: z.string().optional(),
    twitter: z.string().optional(),
    website: z.string().optional(),
  }),

  colors: z
    .object({
      primary: hexColor,
      dark: hexColor,
      accent: hexColor,
      light: hexColor,
      secondary: hexColor,
    })
    .catchall(hexColor),

  typography: z.object({
    heading: z.string(),
    body: z.string(),
    accent: z.string(),
    min_heading_size: z.number().min(8).max(200),
    min_body_size: z.number().min(6).max(72),
  }),

  voice: z.object({
    tone: z.string(),
    personality: z.string(),
    writing_style: z.string(),
    sample_phrases: z.array(z.string()),
  }),

  design_rules: z.object({
    logo_clearspace: z.string(),
    safe_margins: z.string(),
    prohibited: z.array(z.string()),
    required: z.array(z.string()),
  }),

  logos: z.array(brandLogoSchema).min(1),
  additional_assets: z.array(brandAssetSchema).optional(),
});

export type BrandProfileInput = z.input<typeof brandProfileSchema>;
