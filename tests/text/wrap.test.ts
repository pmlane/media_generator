import { describe, it, expect } from "vitest";
import { CHAR_WIDTH_RATIO, needsWrapping, wrapText } from "@/text/wrap";

describe("wrap", () => {
  describe("CHAR_WIDTH_RATIO", () => {
    it("is 0.55", () => {
      expect(CHAR_WIDTH_RATIO).toBe(0.55);
    });
  });

  describe("needsWrapping", () => {
    it("returns false for short text", () => {
      // "Hi" = 2 chars, 2 * 20 * 0.55 = 22 < 500
      expect(needsWrapping("Hi", 20, 500)).toBe(false);
    });

    it("returns true for text exceeding max width", () => {
      // 30 chars * 30 * 0.55 = 495 > 200
      expect(needsWrapping("A very long title that exceeds", 30, 200)).toBe(true);
    });

    it("returns true at boundary due to character width estimate", () => {
      // 10 chars * 20 * 0.55 ≈ 110 (floating point slightly over)
      // The function uses > comparison, and IEEE 754 makes 200*0.55 slightly > 110
      expect(needsWrapping("1234567890", 20, 110)).toBe(true);
    });
  });

  describe("wrapText", () => {
    it("returns single line for short text", () => {
      expect(wrapText("Hello World", 20, 500)).toEqual(["Hello World"]);
    });

    it("splits at word boundaries", () => {
      // fontSize=20, charWidth=11, maxWidth=66 → maxChars=6
      const lines = wrapText("one two three four", 20, 66);
      expect(lines.length).toBeGreaterThan(1);
      // Every line should contain complete words only
      for (const line of lines) {
        expect(line).not.toMatch(/^\s/);
        expect(line).not.toMatch(/\s$/);
      }
    });

    it("never splits mid-word", () => {
      // Single long word with small maxWidth
      const lines = wrapText("Superlongword", 20, 50);
      expect(lines).toEqual(["Superlongword"]);
    });

    it("returns empty array for empty string", () => {
      expect(wrapText("", 20, 500)).toEqual([]);
    });

    it("preserves all words across lines", () => {
      const input = "alpha beta gamma delta epsilon";
      const lines = wrapText(input, 20, 100);
      const rejoined = lines.join(" ");
      expect(rejoined).toBe(input);
    });
  });
});
