/**
 * Generation pipeline orchestrator
 *
 * validate → load brand → create job → run → return results
 */

import { loadBrand } from "../brands/loader.js";
import { JobRunner } from "../jobs/runner.js";
import type {
  GenerationRequest,
  Job,
  ImageProvider,
} from "../media/types.js";
import { eventContentSchema } from "../content/schema.js";
import { menuContentSchema } from "../content/schema.js";
import { socialContentSchema } from "../content/schema.js";
import { ProviderRegistryImpl } from "../providers/registry.js";

interface PipelineConfig {
  brandsDir?: string;
  outputDir?: string;
  maxRetries?: number;
}

export class GenerationPipeline {
  private runner: JobRunner;
  private brandsDir?: string;

  constructor(config?: PipelineConfig, registry?: ProviderRegistryImpl) {
    this.brandsDir = config?.brandsDir;
    this.runner = new JobRunner(
      {
        maxRetries: config?.maxRetries,
        outputDir: config?.outputDir,
      },
      registry
    );
  }

  /**
   * Run the full generation pipeline
   */
  async generate(
    request: GenerationRequest,
    provider?: ImageProvider
  ): Promise<Job> {
    // 1. Validate content
    this.validateContent(request);

    // 2. Load brand
    const brand = loadBrand(request.brandId, this.brandsDir);

    // 3. Run job
    const job = await this.runner.run(request, brand, provider);

    return job;
  }

  getRunner(): JobRunner {
    return this.runner;
  }

  private validateContent(request: GenerationRequest): void {
    switch (request.mediaType) {
      case "event-flyer": {
        const result = eventContentSchema.safeParse(request.content);
        if (!result.success) {
          throw new Error(
            `Invalid event content: ${result.error.issues.map((i) => i.message).join(", ")}`
          );
        }
        break;
      }
      case "print-menu": {
        const result = menuContentSchema.safeParse(request.content);
        if (!result.success) {
          throw new Error(
            `Invalid menu content: ${result.error.issues.map((i) => i.message).join(", ")}`
          );
        }
        break;
      }
      case "social-post": {
        const result = socialContentSchema.safeParse(request.content);
        if (!result.success) {
          throw new Error(
            `Invalid social content: ${result.error.issues.map((i) => i.message).join(", ")}`
          );
        }
        break;
      }
    }
  }
}
