import { describe, it, expect, beforeEach, vi } from "vitest";
import { OpenAIProvider } from "@/providers/openai";

// Mock the openai module
const mockGenerate = vi.fn();
const mockResponsesCreate = vi.fn();

vi.mock("openai", async () => {
  const actual = await vi.importActual<typeof import("openai")>("openai");
  return {
    ...actual,
    default: class MockOpenAI {
      images = { generate: mockGenerate };
      responses = { create: mockResponsesCreate };
    },
  };
});

describe("OpenAIProvider", () => {
  const fakeB64 = Buffer.from("fake-png").toString("base64");

  beforeEach(() => {
    // Clear env vars between tests
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_IMAGE_MODEL;
    delete process.env.OPENAI_IMAGE_QUALITY;
    delete process.env.OPENAI_COST_PER_IMAGE_CENTS;
    delete process.env.OPENAI_RESPONSES_MODEL;
    mockGenerate.mockReset();
    mockResponsesCreate.mockReset();
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

  describe("generate routing", () => {
    const successGenerateResponse = { data: [{ b64_json: fakeB64 }] };
    const successResponsesResponse = {
      output: [{ type: "image_generation_call", result: fakeB64, status: "completed" }],
    };

    it("calls images.generate() when no images provided", async () => {
      mockGenerate.mockResolvedValue(successGenerateResponse);
      const provider = new OpenAIProvider({ apiKey: "sk-test" });

      const result = await provider.generate({
        prompt: "test prompt",
        images: [],
        outputConfig: { aspectRatio: "1:1" },
      });

      expect(result.success).toBe(true);
      expect(mockGenerate).toHaveBeenCalledOnce();
      expect(mockResponsesCreate).not.toHaveBeenCalled();
      expect(mockGenerate).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: "test prompt",
          output_format: "png",
        }),
      );
    });

    it("calls responses.create() when images provided", async () => {
      mockResponsesCreate.mockResolvedValue(successResponsesResponse);
      const provider = new OpenAIProvider({ apiKey: "sk-test" });
      const logoBuffer = Buffer.from("fake-logo-png");

      const result = await provider.generate({
        prompt: "test prompt with logo",
        images: [{ data: logoBuffer, mimeType: "image/png", role: "brand" }],
        outputConfig: { aspectRatio: "1:1" },
      });

      expect(result.success).toBe(true);
      expect(mockResponsesCreate).toHaveBeenCalledOnce();
      expect(mockGenerate).not.toHaveBeenCalled();

      const callArgs = mockResponsesCreate.mock.calls[0][0];
      expect(callArgs.model).toBe("gpt-4o");
      expect(callArgs.tools[0]).toEqual(
        expect.objectContaining({
          type: "image_generation",
          input_fidelity: "high",
          output_format: "png",
        }),
      );
      expect(callArgs.tool_choice).toEqual({ type: "image_generation" });
    });

    it("passes multiple images as content array to responses.create()", async () => {
      mockResponsesCreate.mockResolvedValue(successResponsesResponse);
      const provider = new OpenAIProvider({ apiKey: "sk-test" });

      const result = await provider.generate({
        prompt: "test",
        images: [
          { data: Buffer.from("img1"), mimeType: "image/png", role: "brand" },
          { data: Buffer.from("img2"), mimeType: "image/png", role: "content" },
        ],
        outputConfig: { aspectRatio: "1:1" },
      });

      expect(result.success).toBe(true);
      expect(mockResponsesCreate).toHaveBeenCalledOnce();

      const callArgs = mockResponsesCreate.mock.calls[0][0];
      const content = callArgs.input[0].content;
      const imageParts = content.filter((p: Record<string, unknown>) => p.type === "input_image");
      const textParts = content.filter((p: Record<string, unknown>) => p.type === "input_text");
      expect(imageParts).toHaveLength(2);
      expect(textParts).toHaveLength(1);
    });

    it("returns failure when image generation status is failed", async () => {
      mockResponsesCreate.mockResolvedValue({
        output: [{ type: "image_generation_call", result: null, status: "failed" }],
      });
      const provider = new OpenAIProvider({ apiKey: "sk-test" });

      const result = await provider.generate({
        prompt: "test",
        images: [{ data: Buffer.from("img"), mimeType: "image/png", role: "brand" }],
        outputConfig: { aspectRatio: "1:1" },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Image generation failed");
    });

    it("uses custom responsesModel from config", async () => {
      mockResponsesCreate.mockResolvedValue(successResponsesResponse);
      const provider = new OpenAIProvider({
        apiKey: "sk-test",
        responsesModel: "gpt-4o-mini",
      });

      const result = await provider.generate({
        prompt: "test",
        images: [{ data: Buffer.from("img"), mimeType: "image/png", role: "brand" }],
        outputConfig: { aspectRatio: "1:1" },
      });

      expect(result.success).toBe(true);
      expect(mockResponsesCreate.mock.calls[0][0].model).toBe("gpt-4o-mini");
      expect(result.model).toBe("gpt-4o-mini+gpt-image-1");
    });
  });

  describe("name", () => {
    it("returns 'openai'", () => {
      const provider = new OpenAIProvider();
      expect(provider.name).toBe("openai");
    });
  });
});
