/**
 * Gemini image generation provider
 *
 * Uses Google's Gemini multimodal model for image generation.
 * Model name is configurable via GEMINI_IMAGE_MODEL env var.
 */

import { GoogleGenerativeAI, type Part } from "@google/generative-ai";
import type {
  ImageProvider,
  ProviderRequest,
  ProviderResult,
} from "../media/types.js";

const DEFAULT_MODEL = "gemini-2.0-flash-preview-image-generation";
const DEFAULT_COST_CENTS = 4;

export class GeminiProvider implements ImageProvider {
  readonly name = "gemini";
  private client: GoogleGenerativeAI | null = null;
  private apiKey: string;
  private model: string;
  private costCents: number;

  constructor(config?: { apiKey?: string; model?: string; costCents?: number }) {
    this.apiKey = config?.apiKey ?? process.env.GOOGLE_AI_API_KEY ?? "";
    this.model =
      config?.model ?? process.env.GEMINI_IMAGE_MODEL ?? DEFAULT_MODEL;
    this.costCents =
      config?.costCents ??
      (Number(process.env.GEMINI_COST_PER_IMAGE_CENTS) || DEFAULT_COST_CENTS);

    if (this.apiKey) {
      this.client = new GoogleGenerativeAI(this.apiKey);
    }
  }

  isConfigured(): boolean {
    return !!this.apiKey && !!this.client;
  }

  async generate(request: ProviderRequest): Promise<ProviderResult> {
    if (!this.client) {
      return {
        success: false,
        error: "Gemini provider not configured. Set GOOGLE_AI_API_KEY.",
        errorType: "auth",
      };
    }

    try {
      const contentParts: Part[] = [];

      // Add images first (Gemini expects reference images before text)
      for (const image of request.images) {
        contentParts.push({
          inlineData: {
            mimeType: image.mimeType,
            data: image.data.toString("base64"),
          },
        });
      }

      // Add text prompt last
      contentParts.push({ text: request.prompt });

      const model = this.client.getGenerativeModel({
        model: this.model,
        generationConfig: {
          // @ts-expect-error - responseModalities is valid but not yet in type definitions
          responseModalities: ["TEXT", "IMAGE"],
        },
      });

      const result = await model.generateContent(contentParts);
      const response = result.response;

      const parts = response.candidates?.[0]?.content?.parts;
      if (!parts || parts.length === 0) {
        return {
          success: false,
          error: "No content in Gemini response",
          errorType: "transient",
        };
      }

      // Find the image part
      for (const part of parts) {
        if (
          "inlineData" in part &&
          part.inlineData?.mimeType?.startsWith("image/")
        ) {
          return {
            success: true,
            imageBuffer: Buffer.from(part.inlineData.data, "base64"),
            costCents: this.costCents,
            model: this.model,
          };
        }
      }

      return {
        success: false,
        error: "No image data in Gemini response",
        errorType: "transient",
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown Gemini error";

      // Classify error type
      let errorType: ProviderResult["errorType"] = "transient";
      if (message.includes("API key") || message.includes("401")) {
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
