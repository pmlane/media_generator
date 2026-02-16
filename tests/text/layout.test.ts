import { describe, it, expect } from "vitest";
import { calculateMenuLayout } from "@/text/layout";
import { HALF_LETTER } from "@/media/formats";
import type { BrandProfile, MenuContent } from "@/media/types";

const testBrand: BrandProfile = {
  id: "test-brand",
  name: "Test Brand",
  tagline: "Test tagline",
  venue: {
    address: "123 Test St",
    city: "Portland",
    state: "OR",
    zip: "97201",
    phone: "555-555-5555",
    email: "test@test.com",
  },
  social: { instagram: "@testbrand" },
  colors: {
    primary: "#FF0000",
    dark: "#000000",
    accent: "#FFAA00",
    light: "#FFFFFF",
    secondary: "#888888",
  },
  typography: {
    heading: "Arial",
    body: "Helvetica",
    accent: "Georgia",
    min_heading_size: 24,
    min_body_size: 10,
  },
  voice: {
    tone: "casual",
    personality: "Friendly",
    writing_style: "Short",
    sample_phrases: ["Test"],
  },
  design_rules: {
    logo_clearspace: "Leave space",
    safe_margins: "85%",
    prohibited: [],
    required: [],
  },
  logos: [],
};

const simpleMenu: MenuContent = {
  title: "Cocktail Menu",
  sections: [
    {
      title: "Classics",
      items: [
        { name: "Old Fashioned", price: "$14" },
        { name: "Manhattan", price: "$15" },
      ],
    },
  ],
};

describe("calculateMenuLayout", () => {
  it("canvas dimensions include bleed", () => {
    const layout = calculateMenuLayout(simpleMenu, testBrand, HALF_LETTER);
    // HALF_LETTER: width=1650, height=2550, bleed=38
    expect(layout.width).toBe(1650 + 38 * 2);
    expect(layout.height).toBe(2550 + 38 * 2);
  });

  it("title is first element and centered", () => {
    const layout = calculateMenuLayout(simpleMenu, testBrand, HALF_LETTER);
    expect(layout.elements[0].text).toBe("Cocktail Menu");
    expect(layout.elements[0].anchor).toBe("middle");
  });

  it("produces correct element count", () => {
    // 1 title + 1 section header ("CLASSICS") + 2 names + 2 prices = 6
    const layout = calculateMenuLayout(simpleMenu, testBrand, HALF_LETTER);
    expect(layout.elements).toHaveLength(6);
  });

  it("skips section header when it matches menu title", () => {
    const menu: MenuContent = {
      title: "Cocktail Menu",
      sections: [
        {
          title: "Cocktail Menu",
          items: [
            { name: "Old Fashioned", price: "$14" },
            { name: "Manhattan", price: "$15" },
          ],
        },
      ],
    };
    const layout = calculateMenuLayout(menu, testBrand, HALF_LETTER);
    // 1 title + 0 section header + 2 names + 2 prices = 5
    expect(layout.elements).toHaveLength(5);
  });

  it("has left-aligned names and right-aligned prices in normal mode", () => {
    const layout = calculateMenuLayout(simpleMenu, testBrand, HALF_LETTER);
    // Find item elements (after title and section header)
    const nameEl = layout.elements.find((e) => e.text === "Old Fashioned");
    const priceEl = layout.elements.find((e) => e.text === "$14");
    expect(nameEl?.anchor).toBe("start");
    expect(priceEl?.anchor).toBe("end");
  });

  it("includes subtitle when provided", () => {
    const menu: MenuContent = { ...simpleMenu, subtitle: "Spring 2025" };
    const layout = calculateMenuLayout(menu, testBrand, HALF_LETTER);
    const subtitleEl = layout.elements.find((e) => e.text === "Spring 2025");
    expect(subtitleEl).toBeDefined();
  });

  it("includes footer when provided", () => {
    const menu: MenuContent = { ...simpleMenu, footer: "Prices subject to change" };
    const layout = calculateMenuLayout(menu, testBrand, HALF_LETTER);
    const footerEl = layout.elements.find((e) => e.text === "Prices subject to change");
    expect(footerEl).toBeDefined();
  });

  it("accentColor overrides heading color", () => {
    const layout = calculateMenuLayout(simpleMenu, testBrand, HALF_LETTER, undefined, {
      accentColor: "#00FF00",
    });
    // Title and section header should use accent color
    expect(layout.elements[0].color).toBe("#00FF00");
    const sectionHeader = layout.elements.find((e) => e.text === "CLASSICS");
    expect(sectionHeader?.color).toBe("#00FF00");
  });

  it("headingFont/bodyFont overrides brand fonts", () => {
    const layout = calculateMenuLayout(simpleMenu, testBrand, HALF_LETTER, undefined, {
      headingFont: "CustomHeading",
      bodyFont: "CustomBody",
    });
    expect(layout.elements[0].fontFamily).toBe("CustomHeading");
    const nameEl = layout.elements.find((e) => e.text === "Old Fashioned");
    expect(nameEl?.fontFamily).toBe("CustomBody");
  });

  it("scales fonts down for dense content", () => {
    const denseMenu: MenuContent = {
      title: "Big Menu",
      sections: [
        {
          title: "Section",
          items: Array.from({ length: 30 }, (_, i) => ({
            name: `Item ${i + 1}`,
            price: `$${10 + i}`,
          })),
        },
      ],
    };
    const sparseLayout = calculateMenuLayout(simpleMenu, testBrand, HALF_LETTER);
    const denseLayout = calculateMenuLayout(denseMenu, testBrand, HALF_LETTER);

    const sparseTitleSize = sparseLayout.elements[0].fontSize;
    const denseTitleSize = denseLayout.elements[0].fontSize;
    expect(denseTitleSize).toBeLessThan(sparseTitleSize);
  });

  it("clear zone constrains element positioning", () => {
    const clearZone = { top: 500, bottom: 2000, left: 200, right: 1400 };
    const layout = calculateMenuLayout(simpleMenu, testBrand, HALF_LETTER, clearZone);

    // All elements should be positioned at or below the clear zone top
    // (with some padding added on top)
    for (const el of layout.elements) {
      expect(el.y).toBeGreaterThanOrEqual(500);
    }
  });
});
