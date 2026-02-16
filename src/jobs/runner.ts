/**
 * Local job runner with async queue, retries, and idempotency
 */

import { v4 as uuid } from "uuid";
import sharp from "sharp";
import type {
  Job,
  JobResult,
  GenerationRequest,
  FormatConfig,
  ImageProvider,
  ProviderResult,
  QualityReport,
  BrandProfile,
  BrandLogo,
  MediaRecord,
  MenuContent,
  SourceInput,
  FlyerStyle,
} from "../media/types.js";
import { calculateMenuLayout } from "../text/layout.js";
import { measureClearZone } from "../text/measure.js";
import { renderTextSvg } from "../text/svg-renderer.js";
import { exportPptx } from "../export/pptx-exporter.js";
import { exportPdf } from "../export/pdf-exporter.js";
import { generateIdempotencyKey, hashBuffer, hashString } from "./types.js";
import { resolveFormats } from "../media/formats.js";
import { buildPrompt, type PromptContext } from "../prompts/builder.js";
import { runQualityGate } from "../quality/gate.js";
import { processSocialImage } from "../processing/social.js";
import { processPrintImage } from "../processing/print.js";
import { tintLogo } from "../processing/tint.js";
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
    const activeProvider = provider ?? this.registry.getProvider(request.provider);

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
    const { images: brandImages, preferredBackground } =
      await this.loadBrandImages(brand, request.style, request.customPrompt);

    // Tint brand logos if a custom color was requested
    if (request.logoColor) {
      for (let i = 0; i < brandImages.length; i++) {
        brandImages[i] = {
          ...brandImages[i],
          data: await tintLogo(brandImages[i].data, request.logoColor),
        };
      }
    }

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
        sourceInputs,
        preferredBackground
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
    sourceInputs: SourceInput[],
    preferredBackground?: "light" | "dark"
  ): Promise<JobResult> {
    const warnings: string[] = [];

    const promptCtx: PromptContext = {
      brand,
      format,
      mediaType: request.mediaType,
      content: request.content,
      style: request.style,
      customPrompt: request.customPrompt,
      hasBrandAssets: brandImages.length > 0,
      hasContentImages: contentImages.length > 0,
      preferredBackground,
      textOverlay: request.textOverlay,
    };
    const prompt = buildPrompt(promptCtx);
    const promptHash = hashString(prompt);

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
        outputConfig: {
          aspectRatio: format.aspectRatio,
          quality: request.quality,
        },
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

      // Text overlay: composite programmatic text onto background
      if (request.textOverlay && request.mediaType === "print-menu") {
        const menuContent = request.content as MenuContent;
        const clearZone = await measureClearZone(processedBuffer);
        const layout = calculateMenuLayout(menuContent, brand, format, clearZone, {
          accentColor: request.logoColor,
          headingFont: request.headingFont,
          bodyFont: request.bodyFont,
        });
        const textSvg = renderTextSvg(layout);

        // Save background separately for re-use
        const bgSaveInfo = saveMedia(
          processedBuffer,
          {
            brandId: request.brandId,
            mediaType: request.mediaType,
            format: format.name,
            campaign: request.campaign,
            suffix: "background",
          },
          this.outputDir
        );
        warnings.push(`Background saved: ${bgSaveInfo.filePath}`);

        // Composite text SVG onto background
        processedBuffer = await sharp(processedBuffer)
          .composite([{ input: textSvg, top: 0, left: 0 }])
          .png()
          .toBuffer();

        // Export PPTX if requested
        if (request.exportPptx) {
          try {
            const pptxPath = bgSaveInfo.filePath.replace(
              /-background\.png$/,
              ".pptx"
            );
            exportPptx(bgSaveInfo.filePath, layout, pptxPath);
            warnings.push(`PPTX exported: ${pptxPath}`);
          } catch (err) {
            warnings.push(
              `PPTX export failed: ${err instanceof Error ? err.message : err}`
            );
          }
        }

        // Export editable PDF if requested
        if (request.exportPdf) {
          try {
            const pdfPath = bgSaveInfo.filePath.replace(/-background\.png$/, "-editable.pdf");
            await exportPdf(bgSaveInfo.filePath, layout, pdfPath, format.dpi);
            warnings.push(`PDF exported: ${pdfPath}`);
          } catch (err) {
            warnings.push(
              `PDF export failed: ${err instanceof Error ? err.message : err}`
            );
          }
        }
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

      // Save file (version auto-incremented)
      const { filePath, fileSize, version } = saveMedia(
        processedBuffer,
        {
          brandId: request.brandId,
          mediaType: request.mediaType,
          format: format.name,
          campaign: request.campaign,
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

  private async loadBrandImages(
    brand: BrandProfile,
    style?: FlyerStyle,
    customPrompt?: string
  ): Promise<{
    images: LoadedImage[];
    preferredBackground?: "light" | "dark";
  }> {
    const images: LoadedImage[] = [];
    const primaryLogos = brand.logos.filter(
      (l) => l.type === "primary" || l.type === "secondary"
    );

    // Determine which background the design will likely have
    const bg = inferBackground(style, customPrompt);
    const selected = selectLogosForBackground(primaryLogos, bg);

    for (const logo of selected) {
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

    return { images, preferredBackground: bg };
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

  /**
   * Edit an existing image by sending it to the provider with instructions.
   * Skips brand image loading and prompt building — uses instructions directly.
   */
  async runEdit(
    request: GenerationRequest,
    brand: BrandProfile,
    provider?: ImageProvider
  ): Promise<Job> {
    if (!request.editSource || !request.editInstructions) {
      throw new Error("editSource and editInstructions are required for edit mode");
    }

    const formats = resolveFormats(request.formats);
    const activeProvider = provider ?? this.registry.getProvider(request.provider);

    const job: Job = {
      id: uuid(),
      idempotencyKey: "",
      status: "running",
      request,
      results: [],
      attempts: 0,
      maxRetries: this.maxRetries,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      warnings: [],
    };
    this.jobs.set(job.id, job);

    // Load the source image
    const sourceLoaded = loadImageFile(request.editSource);
    if (!sourceLoaded) {
      throw new Error(`Could not load source image: ${request.editSource}`);
    }

    const sourceImage: LoadedImage = {
      data: sourceLoaded.data,
      mimeType: sourceLoaded.mimeType,
      path: request.editSource,
      name: request.editSource.split("/").pop() ?? "source",
    };

    // Load any additional content images
    const contentImages = await this.loadContentImages(request.images);

    const sourceInputs: SourceInput[] = [
      {
        originalPath: sourceImage.path,
        originalName: sourceImage.name,
        contentHash: hashBuffer(sourceImage.data),
        role: "template" as const,
      },
      ...contentImages.map((img) => ({
        originalPath: img.path,
        originalName: img.name,
        contentHash: hashBuffer(img.data),
        role: "content" as const,
      })),
    ];

    for (let i = 0; i < formats.length; i++) {
      const format = formats[i];
      const result = await this.editForFormat(
        job,
        request,
        brand,
        format,
        activeProvider,
        sourceImage,
        contentImages,
        sourceInputs
      );
      job.results.push(result);

      if (i < formats.length - 1) {
        await new Promise((resolve) =>
          setTimeout(resolve, this.requestDelayMs)
        );
      }
    }

    const allSuccess = job.results.every((r) => r.success);
    const anySuccess = job.results.some((r) => r.success);
    job.status = allSuccess ? "completed" : anySuccess ? "completed" : "failed";
    job.updatedAt = new Date().toISOString();

    for (const result of job.results) {
      job.warnings.push(...result.warnings);
    }

    return job;
  }

  private async editForFormat(
    job: Job,
    request: GenerationRequest,
    brand: BrandProfile,
    format: FormatConfig,
    provider: ImageProvider,
    sourceImage: LoadedImage,
    contentImages: LoadedImage[],
    sourceInputs: SourceInput[]
  ): Promise<JobResult> {
    const warnings: string[] = [];
    const prompt = request.editInstructions!;
    const promptHash = hashString(prompt);

    const providerImages = [
      {
        data: sourceImage.data,
        mimeType: sourceImage.mimeType,
        role: "template" as const,
      },
      ...contentImages.map((img) => ({
        data: img.data,
        mimeType: img.mimeType,
        role: "content" as const,
      })),
    ];

    let lastError = "";
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      job.attempts++;

      const cost = this.registry.estimateCost(1);
      if (!this.registry.checkBudget(cost.costPerGeneration)) {
        return {
          format: format.name,
          success: false,
          error: "Daily budget exceeded",
          warnings,
        };
      }

      const result: ProviderResult = await provider.generate({
        prompt,
        images: providerImages,
        outputConfig: {
          aspectRatio: format.aspectRatio,
          quality: request.quality,
        },
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

      if (result.costCents) {
        this.registry.recordUsage(result.costCents);
      }

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

      const { filePath, fileSize, version } = saveMedia(
        processedBuffer,
        {
          brandId: request.brandId,
          mediaType: request.mediaType,
          format: format.name,
          campaign: request.campaign,
        },
        this.outputDir
      );

      const record: MediaRecord = {
        schemaVersion: 1,
        id: uuid(),
        jobId: job.id,
        brandId: request.brandId,
        mediaType: request.mediaType,
        format: format.name,
        parentId: request.parentId,
        campaign: request.campaign,
        tags: request.tags ?? [],
        version,
        provider: provider.name,
        providerModel: result.model ?? "unknown",
        promptHash,
        sourceInputs,
        generationSeed: request.forceNew ? uuid() : undefined,
        style: request.style,
        customPrompt: request.editInstructions,
        filePath,
        fileSize,
        contentHash: hashBuffer(processedBuffer),
        status: "generated",
        generatedAt: new Date().toISOString(),
        costCents: result.costCents,
      };

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

  getJob(jobId: string): Job | undefined {
    return this.jobs.get(jobId);
  }
}

/**
 * Infer whether the design will have a light or dark background based on
 * the chosen style and any custom prompt hints.
 */
function inferBackground(
  style?: FlyerStyle,
  customPrompt?: string
): "light" | "dark" {
  if (style === "neon" || style === "retro") return "dark";
  if (style === "minimal") return "light";

  const lower = customPrompt?.toLowerCase() ?? "";
  if (lower.includes("dark background")) return "dark";
  if (lower.includes("light background")) return "light";

  // Default: dark backgrounds are more versatile for bar/venue media
  return "dark";
}

/**
 * Pick the best logo variant(s) for the expected background color.
 * Returns at most 1 logo to avoid confusing the AI with multiple variants.
 */
function selectLogosForBackground(
  logos: BrandLogo[],
  background: "light" | "dark"
): BrandLogo[] {
  // Prefer logos tagged for this background
  const matching = logos.filter((l) => l.use_on === background || l.use_on === "any");
  if (matching.length > 0) return [matching[0]];

  // Fallback: take the first available logo
  if (logos.length > 0) return [logos[0]];
  return [];
}

interface LoadedImage {
  data: Buffer;
  mimeType: string;
  path: string;
  name: string;
}
