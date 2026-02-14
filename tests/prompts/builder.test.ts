import { describe, it, expect } from "vitest";
import path from "path";
import { buildPrompt, STYLE_DESCRIPTIONS } from "@/prompts/builder";
import { loadBrand } from "@/brands/loader";
import { INSTAGRAM_SQUARE, LETTER_PORTRAIT } from "@/media/formats";
import type { EventContent, MenuContent, SocialContent } from "@/media/types";

const FIXTURES_DIR = path.resolve(__dirname, "../fixtures");

describe("Prompt Builder", () => {
  const brand = loadBrand("test-brand", FIXTURES_DIR);

  describe("Event Flyer", () => {
    const eventContent: EventContent = {
      eventName: "Drag Bingo",
      date: "2025-03-15",
      time: "7pm",
      description: "An evening of fun and prizes",
    };

    it("builds a complete event flyer prompt", () => {
      const prompt = buildPrompt({
        brand,
        format: INSTAGRAM_SQUARE,
        mediaType: "event-flyer",
        content: eventContent,
        style: "vibrant",
      });

      // Should contain brand identity
      expect(prompt).toContain("Test Brand");
      expect(prompt).toContain("#FF0000");
      expect(prompt).toContain("Arial");

      // Should contain event details
      expect(prompt).toContain("Drag Bingo");
      expect(prompt).toContain("2025-03-15");
      expect(prompt).toContain("7pm");

      // Should contain format specs
      expect(prompt).toContain("1080x1080");
      expect(prompt).toContain("1:1");

      // Should contain design rules
      expect(prompt).toContain("No Comic Sans");
      expect(prompt).toContain("Place the attached brand logo prominently");

      // Should contain style
      expect(prompt).toContain(STYLE_DESCRIPTIONS.vibrant);
    });

    it("includes format-specific print info for print formats", () => {
      const prompt = buildPrompt({
        brand,
        format: LETTER_PORTRAIT,
        mediaType: "event-flyer",
        content: eventContent,
      });

      expect(prompt).toContain("Print");
      expect(prompt).toContain("300");
      expect(prompt).toContain("Bleed");
    });

    it("appends custom instructions", () => {
      const prompt = buildPrompt({
        brand,
        format: INSTAGRAM_SQUARE,
        mediaType: "event-flyer",
        content: eventContent,
        customPrompt: "Use a shamrock theme",
      });

      expect(prompt).toContain("Use a shamrock theme");
    });
  });

  describe("Menu", () => {
    const menuContent: MenuContent = {
      title: "Cocktail Menu",
      sections: [
        {
          title: "Classics",
          items: [
            { name: "Old Fashioned", price: "$14", description: "Bourbon, bitters, orange" },
            { name: "Margarita", price: "$12" },
          ],
        },
      ],
    };

    it("builds a menu prompt with items", () => {
      const prompt = buildPrompt({
        brand,
        format: LETTER_PORTRAIT,
        mediaType: "print-menu",
        content: menuContent,
      });

      expect(prompt).toContain("Cocktail Menu");
      expect(prompt).toContain("Old Fashioned");
      expect(prompt).toContain("$14");
      expect(prompt).toContain("Margarita");
      expect(prompt).toContain("Classics");
    });
  });

  describe("Social Post", () => {
    const socialContent: SocialContent = {
      headline: "Happy Hour 3-6pm",
      body: "Half off well drinks",
    };

    it("builds a social post prompt", () => {
      const prompt = buildPrompt({
        brand,
        format: INSTAGRAM_SQUARE,
        mediaType: "social-post",
        content: socialContent,
      });

      expect(prompt).toContain("Happy Hour 3-6pm");
      expect(prompt).toContain("Half off well drinks");
      expect(prompt).toContain("social media post");
    });
  });

  describe("Image context", () => {
    it("describes template image role", () => {
      const prompt = buildPrompt({
        brand,
        format: INSTAGRAM_SQUARE,
        mediaType: "social-post",
        content: { headline: "Test" } as SocialContent,
        hasTemplateImage: true,
      });

      expect(prompt).toContain("Template image");
      expect(prompt).toContain("Recreate");
    });

    it("includes brand logo placement instruction when brand assets present", () => {
      const prompt = buildPrompt({
        brand,
        format: INSTAGRAM_SQUARE,
        mediaType: "social-post",
        content: { headline: "Test" } as SocialContent,
        hasBrandAssets: true,
      });

      expect(prompt).toContain("Brand logo");
      expect(prompt).toContain("Place it prominently");
      expect(prompt).toContain("use the attached image exactly as provided");
    });

    it("describes content images role", () => {
      const prompt = buildPrompt({
        brand,
        format: INSTAGRAM_SQUARE,
        mediaType: "social-post",
        content: { headline: "Test" } as SocialContent,
        hasContentImages: true,
      });

      expect(prompt).toContain("Content images");
    });
  });
});
