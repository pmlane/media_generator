import { describe, it, expect } from "vitest";
import path from "path";
import { loadBrand, listBrands, validateBrandAssets } from "@/brands/loader";

const FIXTURES_DIR = path.resolve(__dirname, "../fixtures");

describe("Brand Loader", () => {
  describe("loadBrand", () => {
    it("loads and validates a valid brand profile", () => {
      const brand = loadBrand("test-brand", FIXTURES_DIR);

      expect(brand.id).toBe("test-brand");
      expect(brand.name).toBe("Test Brand");
      expect(brand.tagline).toBe("Test tagline");
      expect(brand.colors.primary).toBe("#FF0000");
      expect(brand.typography.heading).toBe("Arial");
      expect(brand.voice.tone).toBe("casual");
      expect(brand.design_rules.prohibited).toContain("No Comic Sans");
      expect(brand.logos).toHaveLength(1);
      expect(brand.logos[0].id).toBe("test-logo");
    });

    it("resolves logo paths relative to brands directory", () => {
      const brand = loadBrand("test-brand", FIXTURES_DIR);

      expect(brand.logos[0].resolvedPath).toBe(
        path.resolve(FIXTURES_DIR, "./test-logo.png")
      );
    });

    it("throws for non-existent brand", () => {
      expect(() => loadBrand("nonexistent", FIXTURES_DIR)).toThrow(
        "Brand profile not found"
      );
    });

    it("throws for invalid brand YAML", () => {
      // We test this by creating a brand without required fields
      // The Zod schema should catch it
      expect(() => loadBrand("invalid-brand", FIXTURES_DIR)).toThrow();
    });

    it("loads the triple-lindy brand profile", () => {
      const brandsDir = path.resolve(__dirname, "../../brands");
      const brand = loadBrand("triple-lindy", brandsDir);

      expect(brand.id).toBe("triple-lindy");
      expect(brand.name).toBe("The Triple Lindy");
      expect(brand.tagline).toBe("Dive in.");
      expect(brand.colors.primary).toBe("#E02020");
      expect(brand.logos.length).toBeGreaterThanOrEqual(5);
    });
  });

  describe("listBrands", () => {
    it("lists available brands from the fixtures directory", () => {
      const brands = listBrands(FIXTURES_DIR);
      expect(brands).toContain("test-brand");
    });

    it("lists available brands from the brands directory", () => {
      const brandsDir = path.resolve(__dirname, "../../brands");
      const brands = listBrands(brandsDir);
      expect(brands).toContain("triple-lindy");
    });
  });

  describe("validateBrandAssets", () => {
    it("reports missing assets", () => {
      const brand = loadBrand("test-brand", FIXTURES_DIR);
      const result = validateBrandAssets(brand);

      // test-logo.png doesn't exist in fixtures
      expect(result.valid).toBe(false);
      expect(result.missing.length).toBeGreaterThan(0);
    });
  });
});
