import { describe, it, expect } from "vitest";
import { parseMenuText } from "@/content/content-loader";

describe("Content Loader", () => {
  describe("parseMenuText", () => {
    it("parses a simple menu with sections", () => {
      const text = `Classics
Old Fashioned - $14
Margarita - $12

Signatures
The Triple Lindy - $16 (rum, lime, coconut)
Portland Mule - $13`;

      const menu = parseMenuText(text, "Cocktail Menu");

      expect(menu.title).toBe("Cocktail Menu");
      expect(menu.sections).toHaveLength(2);

      expect(menu.sections[0].title).toBe("Classics");
      expect(menu.sections[0].items).toHaveLength(2);
      expect(menu.sections[0].items[0].name).toBe("Old Fashioned");
      expect(menu.sections[0].items[0].price).toBe("$14");

      expect(menu.sections[1].title).toBe("Signatures");
      expect(menu.sections[1].items).toHaveLength(2);
      expect(menu.sections[1].items[1].name).toBe("Portland Mule");
      expect(menu.sections[1].items[1].price).toBe("$13");
    });

    it("parses items with descriptions in parentheses", () => {
      const text = `Drinks
Old Fashioned - $14 (bourbon, bitters, orange)`;

      const menu = parseMenuText(text);

      expect(menu.sections[0].items[0].description).toBe(
        "bourbon, bitters, orange"
      );
    });

    it("parses items with em dash separator", () => {
      const text = `Drinks
Margarita — $12`;

      const menu = parseMenuText(text);

      expect(menu.sections[0].items[0].name).toBe("Margarita");
      expect(menu.sections[0].items[0].price).toBe("$12");
    });

    it("parses items with space-separated price", () => {
      const text = `Drinks
Margarita $12`;

      const menu = parseMenuText(text);

      expect(menu.sections[0].items[0].name).toBe("Margarita");
      expect(menu.sections[0].items[0].price).toBe("$12");
    });

    it("handles flat list without sections", () => {
      const text = `Margarita - $12
Old Fashioned - $14
Negroni - $13`;

      const menu = parseMenuText(text, "Quick Menu");

      // Should create a default section
      expect(menu.sections).toHaveLength(1);
      expect(menu.sections[0].items).toHaveLength(3);
    });

    it("handles empty input", () => {
      const menu = parseMenuText("", "Empty");

      expect(menu.sections).toHaveLength(0);
    });

    it("handles multiple blank lines between sections", () => {
      const text = `Starters
Fries - $8


Mains
Burger - $15`;

      const menu = parseMenuText(text);

      expect(menu.sections).toHaveLength(2);
    });
  });
});
