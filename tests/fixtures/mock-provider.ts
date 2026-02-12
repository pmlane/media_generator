/**
 * Mock image provider for testing
 *
 * Returns deterministic test images based on scenario configuration.
 */

import sharp from "sharp";
import type {
  ImageProvider,
  ProviderRequest,
  ProviderResult,
} from "@/media/types";

export type MockScenario =
  | "solid-color"       // Passes basic checks
  | "noisy"             // Passes all checks (varied colors)
  | "blank"             // Fails blank detection
  | "undersized"        // Fails dimension check
  | "fail-then-pass"    // Fails first call, passes second
  | "always-fail";      // Always returns error

export class MockProvider implements ImageProvider {
  readonly name = "mock";
  private callCount = 0;
  scenario: MockScenario;

  constructor(scenario: MockScenario = "noisy") {
    this.scenario = scenario;
  }

  isConfigured(): boolean {
    return true;
  }

  getCallCount(): number {
    return this.callCount;
  }

  resetCallCount(): void {
    this.callCount = 0;
  }

  async generate(request: ProviderRequest): Promise<ProviderResult> {
    this.callCount++;

    switch (this.scenario) {
      case "solid-color":
        return this.generateSolidColor(request);
      case "noisy":
        return this.generateNoisy(request);
      case "blank":
        return this.generateBlank();
      case "undersized":
        return this.generateUndersized();
      case "fail-then-pass":
        if (this.callCount === 1) {
          return this.generateBlank();
        }
        return this.generateNoisy(request);
      case "always-fail":
        return {
          success: false,
          error: "Mock provider always-fail scenario",
          errorType: "transient",
        };
    }
  }

  private async generateSolidColor(
    _request: ProviderRequest
  ): Promise<ProviderResult> {
    // A colored image with some variation (not blank)
    const width = 1080;
    const height = 1080;
    const buffer = await sharp({
      create: {
        width,
        height,
        channels: 3,
        background: { r: 224, g: 32, b: 32 }, // Brand red
      },
    })
      .png()
      .toBuffer();

    // Add some noise/variation by compositing a gradient
    const gradient = await sharp(
      Buffer.from(
        `<svg width="${width}" height="${height}">
          <defs>
            <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style="stop-color:rgb(28,28,28);stop-opacity:0.5" />
              <stop offset="100%" style="stop-color:rgb(214,179,141);stop-opacity:0.3" />
            </linearGradient>
          </defs>
          <rect width="${width}" height="${height}" fill="url(#g)" />
        </svg>`
      )
    )
      .png()
      .toBuffer();

    const final = await sharp(buffer)
      .composite([{ input: gradient, blend: "over" }])
      .png()
      .toBuffer();

    return {
      success: true,
      imageBuffer: final,
      costCents: 0,
      model: "mock-model",
    };
  }

  private async generateNoisy(
    _request: ProviderRequest
  ): Promise<ProviderResult> {
    // Generate a colorful image with high variance
    const width = 1080;
    const height = 1080;

    // Create base with brand colors and random noise
    const buffer = await sharp({
      create: {
        width,
        height,
        channels: 3,
        background: { r: 28, g: 28, b: 28 }, // Dark background
      },
    })
      .png()
      .toBuffer();

    // Add colorful shapes overlay
    const overlay = await sharp(
      Buffer.from(
        `<svg width="${width}" height="${height}">
          <rect x="50" y="50" width="400" height="200" fill="#E02020" rx="10" />
          <rect x="100" y="300" width="600" height="100" fill="#D6B38D" rx="5" />
          <circle cx="800" cy="200" r="150" fill="#F8F8F8" />
          <rect x="200" y="500" width="700" height="300" fill="#9A9A9A" rx="8" />
          <text x="250" y="170" font-size="60" fill="white">Test Event</text>
          <text x="150" y="370" font-size="36" fill="#1C1C1C">March 15, 2025</text>
        </svg>`
      )
    )
      .png()
      .toBuffer();

    const final = await sharp(buffer)
      .composite([{ input: overlay, blend: "over" }])
      .png()
      .toBuffer();

    return {
      success: true,
      imageBuffer: final,
      costCents: 0,
      model: "mock-model",
    };
  }

  private async generateBlank(): Promise<ProviderResult> {
    // Solid white image - should fail blank detection
    const buffer = await sharp({
      create: {
        width: 1080,
        height: 1080,
        channels: 3,
        background: { r: 255, g: 255, b: 255 },
      },
    })
      .png()
      .toBuffer();

    return {
      success: true,
      imageBuffer: buffer,
      costCents: 0,
      model: "mock-model",
    };
  }

  private async generateUndersized(): Promise<ProviderResult> {
    // Very small image - should fail dimension check
    const buffer = await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 3,
        background: { r: 128, g: 64, b: 64 },
      },
    })
      .png()
      .toBuffer();

    return {
      success: true,
      imageBuffer: buffer,
      costCents: 0,
      model: "mock-model",
    };
  }
}
