import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { rmSync, existsSync } from "fs";
import path from "path";
import { GenerationPipeline } from "@/generation/pipeline";
import { MockProvider } from "../fixtures/mock-provider";
import { ProviderRegistryImpl } from "@/providers/registry";
import type { GenerationRequest } from "@/media/types";

const FIXTURES_DIR = path.resolve(__dirname, "../fixtures");
const TEST_OUTPUT = path.resolve(__dirname, "../test-output");

function makeRegistry(provider: MockProvider): ProviderRegistryImpl {
  const registry = new ProviderRegistryImpl({
    dailyBudgetCents: 1000,
    costPerGeneration: 0,
    maxRetries: 2,
  });
  registry.register(provider);
  return registry;
}

describe("Generation Pipeline", () => {
  let pipeline: GenerationPipeline;
  let mockProvider: MockProvider;

  beforeEach(() => {
    mockProvider = new MockProvider("noisy");
    const registry = makeRegistry(mockProvider);
    pipeline = new GenerationPipeline(
      {
        brandsDir: FIXTURES_DIR,
        outputDir: TEST_OUTPUT,
        maxRetries: 2,
      },
      registry
    );
  });

  afterEach(() => {
    if (existsSync(TEST_OUTPUT)) {
      rmSync(TEST_OUTPUT, { recursive: true, force: true });
    }
  });

  describe("Full lifecycle", () => {
    it("generates an event flyer with metadata", async () => {
      const request: GenerationRequest = {
        brandId: "test-brand",
        mediaType: "event-flyer",
        formats: ["instagram"],
        content: {
          eventName: "Drag Bingo",
          date: "2025-03-15",
          time: "7pm",
        },
      };

      const job = await pipeline.generate(request, mockProvider);

      expect(job.status).toBe("completed");
      expect(job.results).toHaveLength(1);

      const result = job.results[0];
      expect(result.success).toBe(true);
      expect(result.format).toBe("INSTAGRAM_SQUARE");
      expect(result.mediaRecord).toBeDefined();
      expect(result.mediaRecord!.brandId).toBe("test-brand");
      expect(result.mediaRecord!.mediaType).toBe("event-flyer");

      // Verify file was saved
      expect(existsSync(result.mediaRecord!.filePath)).toBe(true);

      // Verify metadata sidecar
      const metadataPath = result.mediaRecord!.filePath.replace(".png", ".json");
      expect(existsSync(metadataPath)).toBe(true);
    });

    it("generates a social post", async () => {
      const request: GenerationRequest = {
        brandId: "test-brand",
        mediaType: "social-post",
        formats: ["instagram"],
        content: {
          headline: "Happy Hour 3-6pm",
          body: "Half off well drinks",
        },
      };

      const job = await pipeline.generate(request, mockProvider);

      expect(job.status).toBe("completed");
      expect(job.results[0].success).toBe(true);
    });

    it("generates a menu", async () => {
      const request: GenerationRequest = {
        brandId: "test-brand",
        mediaType: "print-menu",
        formats: ["half-letter"],
        content: {
          title: "Cocktail Menu",
          sections: [
            {
              title: "Classics",
              items: [
                { name: "Old Fashioned", price: "$14" },
                { name: "Margarita", price: "$12" },
              ],
            },
          ],
        },
      };

      const job = await pipeline.generate(request, mockProvider);

      expect(job.status).toBe("completed");
      expect(job.results[0].success).toBe(true);
    });
  });

  describe("Multi-format batch", () => {
    it("generates multiple formats in one job", async () => {
      const request: GenerationRequest = {
        brandId: "test-brand",
        mediaType: "event-flyer",
        formats: ["instagram", "story", "facebook"],
        content: {
          eventName: "Live Music Night",
          date: "2025-04-01",
        },
      };

      const job = await pipeline.generate(request, mockProvider);

      expect(job.status).toBe("completed");
      expect(job.results).toHaveLength(3);
      expect(job.results.every((r) => r.success)).toBe(true);

      // Each format should have correct dimensions
      const formats = job.results.map((r) => r.format);
      expect(formats).toContain("INSTAGRAM_SQUARE");
      expect(formats).toContain("STORY");
      expect(formats).toContain("FACEBOOK");

      // Provider should have been called 3 times
      expect(mockProvider.getCallCount()).toBe(3);
    });
  });

  describe("Retry on quality failure", () => {
    it("retries when quality gate fails", async () => {
      // fail-then-pass: returns blank on first call, valid on second
      mockProvider = new MockProvider("fail-then-pass");
      const registry = makeRegistry(mockProvider);
      pipeline = new GenerationPipeline(
        { brandsDir: FIXTURES_DIR, outputDir: TEST_OUTPUT, maxRetries: 2 },
        registry
      );

      const request: GenerationRequest = {
        brandId: "test-brand",
        mediaType: "social-post",
        formats: ["instagram"],
        content: { headline: "Test Retry" },
      };

      const job = await pipeline.generate(request, mockProvider);

      expect(job.status).toBe("completed");
      expect(job.results[0].success).toBe(true);
      // Should have been called at least twice (first fails quality, second passes)
      expect(mockProvider.getCallCount()).toBeGreaterThanOrEqual(2);
    });
  });

  describe("Validation", () => {
    it("rejects invalid event content", async () => {
      const request: GenerationRequest = {
        brandId: "test-brand",
        mediaType: "event-flyer",
        formats: ["instagram"],
        content: {
          // Missing eventName and date
          headline: "Not an event",
        } as any,
      };

      await expect(pipeline.generate(request, mockProvider)).rejects.toThrow(
        "Invalid event content"
      );
    });

    it("rejects invalid social content", async () => {
      const request: GenerationRequest = {
        brandId: "test-brand",
        mediaType: "social-post",
        formats: ["instagram"],
        content: {
          // Missing headline
          body: "Some body text",
        } as any,
      };

      await expect(pipeline.generate(request, mockProvider)).rejects.toThrow(
        "Invalid social content"
      );
    });
  });

  describe("Provider failure", () => {
    it("fails job when provider always fails", async () => {
      mockProvider = new MockProvider("always-fail");
      const registry = makeRegistry(mockProvider);
      pipeline = new GenerationPipeline(
        { brandsDir: FIXTURES_DIR, outputDir: TEST_OUTPUT, maxRetries: 1 },
        registry
      );

      const request: GenerationRequest = {
        brandId: "test-brand",
        mediaType: "social-post",
        formats: ["instagram"],
        content: { headline: "Will Fail" },
      };

      const job = await pipeline.generate(request, mockProvider);

      expect(job.status).toBe("failed");
      expect(job.results[0].success).toBe(false);
    });
  });

  describe("Metadata", () => {
    it("records tags and campaign in metadata", async () => {
      const request: GenerationRequest = {
        brandId: "test-brand",
        mediaType: "social-post",
        formats: ["instagram"],
        content: { headline: "St Patricks Day" },
        tags: ["seasonal", "holiday"],
        campaign: "st-patricks-2025",
      };

      const job = await pipeline.generate(request, mockProvider);

      expect(job.results[0].mediaRecord!.tags).toEqual([
        "seasonal",
        "holiday",
      ]);
      expect(job.results[0].mediaRecord!.campaign).toBe("st-patricks-2025");
    });

    it("records style in metadata", async () => {
      const request: GenerationRequest = {
        brandId: "test-brand",
        mediaType: "event-flyer",
        formats: ["instagram"],
        content: { eventName: "Neon Night", date: "2025-05-01" },
        style: "neon",
      };

      const job = await pipeline.generate(request, mockProvider);

      expect(job.results[0].mediaRecord!.style).toBe("neon");
    });
  });
});
