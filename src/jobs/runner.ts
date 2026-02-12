/**
 * Local job runner with async queue, retries, and idempotency
 */

import { v4 as uuid } from "uuid";
import type {
  Job,
  JobResult,
  GenerationRequest,
  FormatConfig,
  ImageProvider,
  ProviderResult,
  QualityReport,
  BrandProfile,
  MediaRecord,
  SourceInput,
} from "../media/types.js";
import { generateIdempotencyKey, hashBuffer, hashString } from "./types.js";
import { resolveFormats } from "../media/formats.js";
import { buildPrompt, type PromptContext } from "../prompts/builder.js";
import { runQualityGate } from "../quality/gate.js";
import { processSocialImage } from "../processing/social.js";
import { processPrintImage } from "../processing/print.js";
import { saveMedia, saveMetadata } from "../storage/file-storage.js";
import { loadImageFile } from "../content/content-loader.js";
import { ProviderRegistryImpl } from "../providers/registry.js";

interface RunnerConfig {
  maxRetries?: number;
  requestDelayMs?: number;
  outputDir?: string;
}

export class JobRunner {
  private jobs: Map<string, Job> = new Map();
  private registry: ProviderRegistryImpl;
  private maxRetries: number;
  private requestDelayMs: number;
  private outputDir: string;

  constructor(config?: RunnerConfig, registry?: ProviderRegistryImpl) {
    this.registry = registry ?? new ProviderRegistryImpl();
    this.maxRetries = config?.maxRetries ?? (Number(process.env.MAX_RETRIES) || 2);
    this.requestDelayMs =
      config?.requestDelayMs ?? (Number(process.env.REQUEST_DELAY_MS) || 500);
    this.outputDir = config?.outputDir ?? "output";
  }

  getRegistry(): ProviderRegistryImpl {
    return this.registry;
  }

  /**
   * Submit a generation request and run it
   */
  async run(
    request: GenerationRequest,
    brand: BrandProfile,
    provider?: ImageProvider
  ): Promise<Job> {
    const formats = resolveFormats(request.formats);
    const activeProvider = provider ?? this.registry.getProvider();

    const job: Job = {
      id: uuid(),
      idempotencyKey: "",
      status: "pending",
      request,
      results: [],
      attempts: 0,
      maxRetries: this.maxRetries,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      warnings: [],
    };

    this.jobs.set(job.id, job);
    job.status = "running";

    // Load input images (brand assets + content images)
    const brandImages = await this.loadBrandImages(brand);
    const contentImages = await this.loadContentImages(request.images);

    // Track source inputs for metadata
    const sourceInputs: SourceInput[] = [
      ...brandImages.map((img) => ({
        originalPath: img.path,
        originalName: img.name,
        contentHash: hashBuffer(img.data),
        role: "brand" as const,
      })),
      ...contentImages.map((img) => ({
        originalPath: img.path,
        originalName: img.name,
        contentHash: hashBuffer(img.data),
        role: "content" as const,
      })),
    ];

    const imageHashes = sourceInputs.map((s) => s.contentHash);

    // Process each format
    for (let i = 0; i < formats.length; i++) {
      const format = formats[i];
      const idempotencyKey = generateIdempotencyKey(
        request,
        format.name,
        imageHashes
      );
      job.idempotencyKey = idempotencyKey;

      // Check idempotency (skip if --new)
      if (!request.forceNew) {
        const existing = this.findByIdempotencyKey(idempotencyKey);
        if (existing) {
          const existingResult = existing.results.find(
            (r) => r.format === format.name && r.success
          );
          if (existingResult) {
            job.results.push(existingResult);
            continue;
          }
        }
      }

      const result = await this.generateForFormat(
        job,
        request,
        brand,
        format,
        activeProvider,
        brandImages,
        contentImages,
        sourceInputs
      );
      job.results.push(result);

      // Delay between requests
      if (i < formats.length - 1) {
        await new Promise((resolve) =>
          setTimeout(resolve, this.requestDelayMs)
        );
      }
    }

    // Final status
    const allSuccess = job.results.every((r) => r.success);
    const anySuccess = job.results.some((r) => r.success);
    job.status = allSuccess ? "completed" : anySuccess ? "completed" : "failed";
    job.updatedAt = new Date().toISOString();

    // Collect warnings
    for (const result of job.results) {
      job.warnings.push(...result.warnings);
    }

    return job;
  }

  private async generateForFormat(
    job: Job,
    request: GenerationRequest,
    brand: BrandProfile,
    format: FormatConfig,
    provider: ImageProvider,
    brandImages: LoadedImage[],
    contentImages: LoadedImage[],
    sourceInputs: SourceInput[]
  ): Promise<JobResult> {
    const warnings: string[] = [];

    // Build prompt
    const promptCtx: PromptContext = {
      brand,
      format,
      mediaType: request.mediaType,
      content: request.content,
      style: request.style,
      customPrompt: request.customPrompt,
      hasBrandAssets: brandImages.length > 0,
      hasContentImages: contentImages.length > 0,
    };
    const prompt = buildPrompt(promptCtx);
    const promptHash = hashString(prompt);

    // Assemble provider images
    const providerImages = [
      ...brandImages.map((img) => ({
        data: img.data,
        mimeType: img.mimeType,
        role: "brand" as const,
      })),
      ...contentImages.map((img) => ({
        data: img.data,
        mimeType: img.mimeType,
        role: "content" as const,
      })),
    ];

    // Attempt generation with retries
    let lastError = "";
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      job.attempts++;

      // Budget check
      const cost = this.registry.estimateCost(1);
      if (!this.registry.checkBudget(cost.costPerGeneration)) {
        return {
          format: format.name,
          success: false,
          error: "Daily budget exceeded",
          warnings,
        };
      }

      // Call provider
      const result: ProviderResult = await provider.generate({
        prompt,
        images: providerImages,
        outputConfig: { aspectRatio: format.aspectRatio },
      });

      if (!result.success) {
        if (
          result.errorType === "auth" ||
          result.errorType === "validation" ||
          result.errorType === "budget"
        ) {
          return {
            format: format.name,
            success: false,
            error: result.error,
            warnings,
          };
        }
        lastError = result.error ?? "Unknown error";
        if (attempt < this.maxRetries) {
          job.status = "retrying";
          const backoff = Math.pow(2, attempt) * 1000;
          await new Promise((resolve) => setTimeout(resolve, backoff));
          continue;
        }
        break;
      }

      // Track cost
      if (result.costCents) {
        this.registry.recordUsage(result.costCents);
      }

      // Post-process first (resize to target dimensions)
      let processedBuffer: Buffer;
      if (format.category === "print") {
        processedBuffer = await processPrintImage(result.imageBuffer!, format, {
          printReady: request.printReady,
        });
      } else {
        processedBuffer = await processSocialImage(
          result.imageBuffer!,
          format
        );
      }

      // Quality gate (on processed/resized image)
      const qualityReport: QualityReport = await runQualityGate(
        processedBuffer,
        {
          targetFormat: format,
          mediaType: request.mediaType,
          brandColors: Object.values(brand.colors),
        }
      );

      if (!qualityReport.passed) {
        lastError = `Quality check failed: ${qualityReport.checks
          .filter((c) => c.result === "fail")
          .map((c) => c.message)
          .join("; ")}`;
        if (attempt < this.maxRetries) {
          job.status = "retrying";
          continue;
        }
        break;
      }

      warnings.push(...qualityReport.warnings);

      // Determine version
      const version = 1; // TODO: increment from existing

      // Save file
      const { filePath, fileSize } = saveMedia(
        processedBuffer,
        {
          brandId: request.brandId,
          mediaType: request.mediaType,
          format: format.name,
          campaign: request.campaign,
          version,
        },
        this.outputDir
      );

      // Build metadata record
      const record: MediaRecord = {
        schemaVersion: 1,
        id: uuid(),
        jobId: job.id,
        brandId: request.brandId,
        mediaType: request.mediaType,
        format: format.name,
        parentId: request.parentId,
        eventName:
          "eventName" in request.content
            ? (request.content as any).eventName
            : undefined,
        eventDate:
          "date" in request.content
            ? (request.content as any).date
            : undefined,
        campaign: request.campaign,
        tags: request.tags ?? [],
        version,
        provider: provider.name,
        providerModel: result.model ?? "unknown",
        promptHash,
        sourceInputs,
        generationSeed: request.forceNew ? uuid() : undefined,
        style: request.style,
        customPrompt: request.customPrompt,
        filePath,
        fileSize,
        contentHash: hashBuffer(processedBuffer),
        status: "generated",
        generatedAt: new Date().toISOString(),
        costCents: result.costCents,
      };

      // Save metadata sidecar
      saveMetadata(record, this.outputDir);

      return {
        format: format.name,
        success: true,
        mediaRecord: record,
        warnings,
        costCents: result.costCents,
      };
    }

    return {
      format: format.name,
      success: false,
      error: lastError || "Max retries exceeded",
      warnings,
    };
  }

  private findByIdempotencyKey(key: string): Job | undefined {
    for (const job of this.jobs.values()) {
      if (job.idempotencyKey === key && job.status === "completed") {
        return job;
      }
    }
    return undefined;
  }

  private async loadBrandImages(brand: BrandProfile): Promise<LoadedImage[]> {
    const images: LoadedImage[] = [];
    for (const logo of brand.logos) {
      const resolved = logo.resolvedPath ?? logo.path;
      try {
        const loaded = loadImageFile(resolved);
        if (loaded) {
          images.push({
            data: loaded.data,
            mimeType: loaded.mimeType,
            path: resolved,
            name: logo.id,
          });
        }
      } catch {
        // Skip missing brand assets with warning
      }
    }
    return images;
  }

  private async loadContentImages(
    paths?: string[]
  ): Promise<LoadedImage[]> {
    if (!paths?.length) return [];
    const images: LoadedImage[] = [];
    for (const p of paths) {
      try {
        const loaded = loadImageFile(p);
        if (loaded) {
          images.push({
            data: loaded.data,
            mimeType: loaded.mimeType,
            path: p,
            name: p.split("/").pop() ?? p,
          });
        }
      } catch {
        // Skip missing content images with warning
      }
    }
    return images;
  }

  getJob(jobId: string): Job | undefined {
    return this.jobs.get(jobId);
  }
}

interface LoadedImage {
  data: Buffer;
  mimeType: string;
  path: string;
  name: string;
}
