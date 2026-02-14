/**
 * OpenAI image generation provider
 *
 * Uses OpenAI's GPT Image models for image generation.
 * Model name is configurable via OPENAI_IMAGE_MODEL env var.
 */

import OpenAI from "openai";
import type {
  ImageProvider,
  ProviderRequest,
  ProviderResult,
} from "../media/types.js";

const DEFAULT_MODEL = "gpt-image-1";
const DEFAULT_QUALITY = "medium";
const DEFAULT_COST_CENTS = 4;

/** Map aspect ratio string to OpenAI size parameter */
function mapSize(aspectRatio: string): "1024x1024" | "1024x1536" | "1536x1024" | "auto" {
  // Parse "W:H" format
  const parts = aspectRatio.split(":");
  if (parts.length === 2) {
    const w = Number(parts[0]);
    const h = Number(parts[1]);
    if (w > h) return "1536x1024";  // landscape
    if (h > w) return "1024x1536";  // portrait
  }
  return "1024x1024"; // square / fallback
}

export class OpenAIProvider implements ImageProvider {
  readonly name = "openai";
  private client: OpenAI | null = null;
  private apiKey: string;
  private model: string;
  private quality: string;
  private costCents: number;

  constructor(config?: {
    apiKey?: string;
    model?: string;
    quality?: string;
    costCents?: number;
  }) {
    this.apiKey = config?.apiKey ?? process.env.OPENAI_API_KEY ?? "";
    this.model =
      config?.model ?? process.env.OPENAI_IMAGE_MODEL ?? DEFAULT_MODEL;
    this.quality =
      config?.quality ?? process.env.OPENAI_IMAGE_QUALITY ?? DEFAULT_QUALITY;
    this.costCents =
      config?.costCents ??
      (Number(process.env.OPENAI_COST_PER_IMAGE_CENTS) || DEFAULT_COST_CENTS);

    if (this.apiKey) {
      this.client = new OpenAI({ apiKey: this.apiKey });
    }
  }

  isConfigured(): boolean {
    return !!this.apiKey && !!this.client;
  }

  async generate(request: ProviderRequest): Promise<ProviderResult> {
    if (!this.client) {
      return {
        success: false,
        error: "OpenAI provider not configured. Set OPENAI_API_KEY.",
        errorType: "auth",
      };
    }

    try {
      const size = mapSize(request.outputConfig.aspectRatio);
      const quality = request.outputConfig.quality ?? this.quality;

      const result = await this.client.images.generate({
        model: this.model,
        prompt: request.prompt,
        n: 1,
        size,
        quality: quality as "low" | "medium" | "high",
        output_format: "png",
      });

      const b64 = result.data?.[0]?.b64_json;
      if (!b64) {
        return {
          success: false,
          error: "No image data in OpenAI response",
          errorType: "transient",
        };
      }

      return {
        success: true,
        imageBuffer: Buffer.from(b64, "base64"),
        costCents: this.costCents,
        model: this.model,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown OpenAI error";

      // Classify error type
      let errorType: ProviderResult["errorType"] = "transient";
      if (message.includes("API key") || message.includes("401") || message.includes("Incorrect API key")) {
        errorType = "auth";
      } else if (message.includes("429") || message.includes("rate")) {
        errorType = "rate_limit";
      } else if (message.includes("400") || message.includes("invalid")) {
        errorType = "validation";
      }

      return {
        success: false,
        error: message,
        errorType,
      };
    }
  }
}
