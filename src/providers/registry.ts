/**
 * Provider registry with budget tracking and rate controls
 */

import type {
  ImageProvider,
  ProviderRegistry as IProviderRegistry,
  CostEstimate,
} from "../media/types.js";
import { GeminiProvider } from "./gemini.js";
import { OpenAIProvider } from "./openai.js";

interface UsageEntry {
  timestamp: number;
  costCents: number;
}

export class ProviderRegistryImpl implements IProviderRegistry {
  private providers: Map<string, ImageProvider> = new Map();
  private usage: UsageEntry[] = [];
  private dailyBudgetCents: number;
  private costPerGeneration: number;
  private maxRetries: number;

  constructor(config?: {
    dailyBudgetCents?: number;
    costPerGeneration?: number;
    maxRetries?: number;
  }) {
    this.dailyBudgetCents =
      config?.dailyBudgetCents ??
      (Number(process.env.DAILY_BUDGET_CENTS) || 500);
    this.costPerGeneration =
      config?.costPerGeneration ??
      (Number(process.env.GEMINI_COST_PER_IMAGE_CENTS) || 4);
    this.maxRetries =
      config?.maxRetries ?? (Number(process.env.MAX_RETRIES) || 2);

    // Register providers
    this.register(new GeminiProvider());
    this.register(new OpenAIProvider());
  }

  register(provider: ImageProvider): void {
    this.providers.set(provider.name, provider);
  }

  getProvider(preference?: string): ImageProvider {
    if (preference) {
      const provider = this.providers.get(preference);
      if (provider && provider.isConfigured()) {
        return provider;
      }
      throw new Error(
        `Provider "${preference}" is not available or not configured`
      );
    }

    // Return first configured provider
    for (const provider of this.providers.values()) {
      if (provider.isConfigured()) {
        return provider;
      }
    }

    throw new Error(
      "No configured image providers. Set GOOGLE_AI_API_KEY or OPENAI_API_KEY in .env"
    );
  }

  checkBudget(estimatedCostCents: number): boolean {
    const { totalCents } = this.getUsageToday();
    return totalCents + estimatedCostCents <= this.dailyBudgetCents;
  }

  recordUsage(costCents: number): void {
    this.usage.push({ timestamp: Date.now(), costCents });
  }

  getUsageToday(): { totalCents: number; callCount: number } {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayMs = todayStart.getTime();

    const todayUsage = this.usage.filter((u) => u.timestamp >= todayMs);
    return {
      totalCents: todayUsage.reduce((sum, u) => sum + u.costCents, 0),
      callCount: todayUsage.length,
    };
  }

  estimateCost(formatCount: number): CostEstimate {
    const bestCase = formatCount * this.costPerGeneration;
    const worstCase = formatCount * this.costPerGeneration * (1 + this.maxRetries);
    const { totalCents } = this.getUsageToday();

    return {
      formatCount,
      costPerGeneration: this.costPerGeneration,
      maxRetries: this.maxRetries,
      bestCase,
      worstCase,
      withinBudget: totalCents + worstCase <= this.dailyBudgetCents,
    };
  }
}
