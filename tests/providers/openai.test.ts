import { describe, it, expect, beforeEach, vi } from "vitest";
import { OpenAIProvider } from "@/providers/openai";

describe("OpenAIProvider", () => {
  beforeEach(() => {
    // Clear env vars between tests
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_IMAGE_MODEL;
    delete process.env.OPENAI_IMAGE_QUALITY;
    delete process.env.OPENAI_COST_PER_IMAGE_CENTS;
  });

  describe("constructor", () => {
    it("reads API key from config", () => {
      const provider = new OpenAIProvider({ apiKey: "sk-test-key" });
      expect(provider.isConfigured()).toBe(true);
    });

    it("reads API key from env", () => {
      process.env.OPENAI_API_KEY = "sk-env-key";
      const provider = new OpenAIProvider();
      expect(provider.isConfigured()).toBe(true);
    });

    it("is not configured without API key", () => {
      const provider = new OpenAIProvider();
      expect(provider.isConfigured()).toBe(false);
    });

    it("prefers config over env", () => {
      process.env.OPENAI_API_KEY = "sk-env-key";
      const provider = new OpenAIProvider({ apiKey: "sk-config-key" });
      expect(provider.isConfigured()).toBe(true);
      expect(provider.name).toBe("openai");
    });

    it("reads model from env", () => {
      process.env.OPENAI_IMAGE_MODEL = "gpt-image-1-mini";
      const provider = new OpenAIProvider({ apiKey: "sk-test" });
      expect(provider.isConfigured()).toBe(true);
    });
  });

  describe("isConfigured", () => {
    it("returns false without API key", () => {
      const provider = new OpenAIProvider();
      expect(provider.isConfigured()).toBe(false);
    });

    it("returns true with API key", () => {
      const provider = new OpenAIProvider({ apiKey: "sk-test" });
      expect(provider.isConfigured()).toBe(true);
    });
  });

  describe("generate", () => {
    it("returns auth error when not configured", async () => {
      const provider = new OpenAIProvider();
      const result = await provider.generate({
        prompt: "test",
        images: [],
        outputConfig: { aspectRatio: "1:1" },
      });

      expect(result.success).toBe(false);
      expect(result.errorType).toBe("auth");
      expect(result.error).toContain("OPENAI_API_KEY");
    });
  });

  describe("name", () => {
    it("returns 'openai'", () => {
      const provider = new OpenAIProvider();
      expect(provider.name).toBe("openai");
    });
  });
});
