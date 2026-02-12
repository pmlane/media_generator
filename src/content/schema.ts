/**
 * Zod validation schemas for content types
 */

import { z } from "zod";

export const eventContentSchema = z.object({
  eventName: z.string().min(1, "Event name is required"),
  date: z.string().min(1, "Date is required"),
  time: z.string().optional(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  campaign: z.string().optional(),
});

export const menuItemSchema = z.object({
  name: z.string().min(1),
  price: z.string().optional(),
  description: z.string().optional(),
});

export const menuSectionSchema = z.object({
  title: z.string().min(1),
  items: z.array(menuItemSchema).min(1),
});

export const menuContentSchema = z.object({
  title: z.string().min(1, "Menu title is required"),
  sections: z.array(menuSectionSchema).min(1, "At least one section is required"),
  subtitle: z.string().optional(),
  footer: z.string().optional(),
  tags: z.array(z.string()).optional(),
  campaign: z.string().optional(),
});

export const socialContentSchema = z.object({
  headline: z.string().min(1, "Headline is required"),
  body: z.string().optional(),
  hashtags: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  campaign: z.string().optional(),
});
