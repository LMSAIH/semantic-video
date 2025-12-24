/**
 * OpenAI Vision Models Configuration
 * 
 * Contains pricing, capabilities, and token calculation multipliers
 * for vision-capable models.
 * 
 * Pricing source: https://platform.openai.com/docs/pricing
 * Last updated: December 2025
 */

export interface ModelPricing {
  /** Cost per 1M input tokens in USD */
  inputCostPerMillion: number;
  /** Cost per 1M cached input tokens in USD */
  cachedInputCostPerMillion: number;
  /** Cost per 1M output tokens in USD */
  outputCostPerMillion: number;
}

export interface VisionModelConfig {
  /** Model identifier */
  id: string;
  /** Human-readable model name */
  name: string;
  /** Model description */
  description: string;
  /** Whether this model supports vision/image inputs */
  supportsVision: boolean;
  /** Pricing information */
  pricing: ModelPricing;
  /** 
   * Image token calculation multiplier
   * Applied to base image token count for accurate estimation
   * Different models process images differently, affecting token usage
   */
  imageTokenMultiplier: number;
  /** Maximum context window size in tokens */
  maxContextTokens: number;
  /** Whether this model is deprecated */
  deprecated: boolean;
}

/**
 * Vision-capable OpenAI models with their configurations
 * Ordered by capability tier (most capable first within each family)
 */
export const VISION_MODELS: Record<string, VisionModelConfig> = {
  // GPT-5 Family
  "gpt-5.2": {
    id: "gpt-5.2",
    name: "GPT-5.2",
    description: "The best model for coding and agentic tasks across industries",
    supportsVision: true,
    pricing: {
      inputCostPerMillion: 1.75,
      cachedInputCostPerMillion: 0.175,
      outputCostPerMillion: 14.00,
    },
    imageTokenMultiplier: 1.0,
    maxContextTokens: 128000,
    deprecated: false,
  },
  "gpt-5.2-pro": {
    id: "gpt-5.2-pro",
    name: "GPT-5.2 Pro",
    description: "Version of GPT-5.2 that produces smarter and more precise responses",
    supportsVision: true,
    pricing: {
      inputCostPerMillion: 21.00,
      cachedInputCostPerMillion: 21.00, // No caching discount listed
      outputCostPerMillion: 168.00,
    },
    imageTokenMultiplier: 1.0,
    maxContextTokens: 128000,
    deprecated: false,
  },
  "gpt-5.1": {
    id: "gpt-5.1",
    name: "GPT-5.1",
    description: "Intelligent reasoning model with configurable reasoning effort",
    supportsVision: true,
    pricing: {
      inputCostPerMillion: 1.25,
      cachedInputCostPerMillion: 0.125,
      outputCostPerMillion: 10.00,
    },
    imageTokenMultiplier: 1.0,
    maxContextTokens: 128000,
    deprecated: false,
  },
  "gpt-5": {
    id: "gpt-5",
    name: "GPT-5",
    description: "Previous intelligent reasoning model for coding and agentic tasks",
    supportsVision: true,
    pricing: {
      inputCostPerMillion: 1.25,
      cachedInputCostPerMillion: 0.125,
      outputCostPerMillion: 10.00,
    },
    imageTokenMultiplier: 1.0,
    maxContextTokens: 128000,
    deprecated: false,
  },
  "gpt-5-pro": {
    id: "gpt-5-pro",
    name: "GPT-5 Pro",
    description: "Version of GPT-5 that produces smarter and more precise responses",
    supportsVision: true,
    pricing: {
      inputCostPerMillion: 15.00,
      cachedInputCostPerMillion: 15.00,
      outputCostPerMillion: 120.00,
    },
    imageTokenMultiplier: 1.0,
    maxContextTokens: 128000,
    deprecated: false,
  },
  "gpt-5-mini": {
    id: "gpt-5-mini",
    name: "GPT-5 Mini",
    description: "A faster, cost-efficient version of GPT-5 for well-defined tasks",
    supportsVision: true,
    pricing: {
      inputCostPerMillion: 0.25,
      cachedInputCostPerMillion: 0.025,
      outputCostPerMillion: 2.00,
    },
    imageTokenMultiplier: 1.62,
    maxContextTokens: 128000,
    deprecated: false,
  },
  "gpt-5-nano": {
    id: "gpt-5-nano",
    name: "GPT-5 Nano",
    description: "Fastest, most cost-efficient version of GPT-5",
    supportsVision: true,
    pricing: {
      inputCostPerMillion: 0.05,
      cachedInputCostPerMillion: 0.005,
      outputCostPerMillion: 0.40,
    },
    imageTokenMultiplier: 2.46,
    maxContextTokens: 128000,
    deprecated: false,
  },

  // GPT-4.1 Family
  "gpt-4.1": {
    id: "gpt-4.1",
    name: "GPT-4.1",
    description: "Smartest non-reasoning model",
    supportsVision: true,
    pricing: {
      inputCostPerMillion: 2.00,
      cachedInputCostPerMillion: 0.50,
      outputCostPerMillion: 8.00,
    },
    imageTokenMultiplier: 1.0,
    maxContextTokens: 128000,
    deprecated: false,
  },
  "gpt-4.1-mini": {
    id: "gpt-4.1-mini",
    name: "GPT-4.1 Mini",
    description: "Smaller, faster version of GPT-4.1",
    supportsVision: true,
    pricing: {
      inputCostPerMillion: 0.40,
      cachedInputCostPerMillion: 0.10,
      outputCostPerMillion: 1.60,
    },
    imageTokenMultiplier: 1.62,
    maxContextTokens: 128000,
    deprecated: false,
  },
  "gpt-4.1-nano": {
    id: "gpt-4.1-nano",
    name: "GPT-4.1 Nano",
    description: "Smallest, fastest version of GPT-4.1",
    supportsVision: true,
    pricing: {
      inputCostPerMillion: 0.10,
      cachedInputCostPerMillion: 0.025,
      outputCostPerMillion: 0.40,
    },
    imageTokenMultiplier: 2.46,
    maxContextTokens: 128000,
    deprecated: false,
  },
  // O-Series (Reasoning models)
  "o3": {
    id: "o3",
    name: "o3",
    description: "Reasoning model for complex tasks, succeeded by GPT-5",
    supportsVision: true,
    pricing: {
      inputCostPerMillion: 2.00,
      cachedInputCostPerMillion: 0.50,
      outputCostPerMillion: 8.00,
    },
    imageTokenMultiplier: 1.0,
    maxContextTokens: 200000,
    deprecated: false,
  },
  "o3-pro": {
    id: "o3-pro",
    name: "o3 Pro",
    description: "Version of o3 with more compute for better responses",
    supportsVision: true,
    pricing: {
      inputCostPerMillion: 20.00,
      cachedInputCostPerMillion: 20.00,
      outputCostPerMillion: 80.00,
    },
    imageTokenMultiplier: 1.0,
    maxContextTokens: 200000,
    deprecated: false,
  },
  "o4-mini": {
    id: "o4-mini",
    name: "o4 Mini",
    description: "Fast, cost-efficient reasoning model, succeeded by GPT-5 mini",
    supportsVision: true,
    pricing: {
      inputCostPerMillion: 1.10,
      cachedInputCostPerMillion: 0.275,
      outputCostPerMillion: 4.40,
    },
    imageTokenMultiplier: 1.72,
    maxContextTokens: 200000,
    deprecated: false,
  },
  "o1": {
    id: "o1",
    name: "o1",
    description: "Previous full o-series reasoning model",
    supportsVision: true,
    pricing: {
      inputCostPerMillion: 15.00,
      cachedInputCostPerMillion: 7.50,
      outputCostPerMillion: 60.00,
    },
    imageTokenMultiplier: 1.0,
    maxContextTokens: 200000,
    deprecated: false,
  },
};

/**
 * Default model to use when none specified
 */
export const DEFAULT_VISION_MODEL = "gpt-5-nano";

export function getSupportedModels(): string[] {
  return Object.keys(VISION_MODELS).filter(
    (id) => !VISION_MODELS[id].deprecated
  );
}

/**
 * Gets the configuration for a model, falling back to default if not found
 */
export function getModelConfig(modelId: string): VisionModelConfig {
  return VISION_MODELS[modelId] || VISION_MODELS[DEFAULT_VISION_MODEL];
}

/**
 * Gets the pricing for a model, falling back to default if not found
 */
export function getModelPricing(modelId: string): ModelPricing {
  const config = getModelConfig(modelId);
  return config.pricing;
}

/**
 * Gets the image token multiplier for a model
 */
export function getImageTokenMultiplier(modelId: string): number {
  const config = getModelConfig(modelId);
  return config.imageTokenMultiplier;
}

/**
 * Calculates the cost for a given number of tokens
 */
export function calculateCost(
  inputTokens: number,
  outputTokens: number,
  modelId: string = DEFAULT_VISION_MODEL,
  useCachedInput: boolean = false
): number {
  const pricing = getModelPricing(modelId);
  const inputCostRate = useCachedInput
    ? pricing.cachedInputCostPerMillion
    : pricing.inputCostPerMillion;

  const inputCost = (inputTokens / 1_000_000) * inputCostRate;
  const outputCost = (outputTokens / 1_000_000) * pricing.outputCostPerMillion;

  return inputCost + outputCost;
}

/**
 * Gets all available vision model IDs
 */
export function getAvailableModels(): string[] {
  return Object.keys(VISION_MODELS).filter(
    (id) => !VISION_MODELS[id].deprecated
  );
}

/**
 * Gets models sorted by cost (cheapest first)
 */
export function getModelsByCost(): VisionModelConfig[] {
  return Object.values(VISION_MODELS)
    .filter((m) => !m.deprecated)
    .sort((a, b) => a.pricing.inputCostPerMillion - b.pricing.inputCostPerMillion);
}
