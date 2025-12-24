import { encoding_for_model, TiktokenModel } from "tiktoken";
import sharp from "sharp";
import { DEFAULT_MODEL } from "./constants";
import { getImageTokenMultiplier, calculateCost } from "./models";

interface TokenEstimate {
  textTokens: number;
  imageTokens: number;
  totalTokens: number;
  estimatedCost: number;
  model: string;
}

/**
 * Calculates the number of tokens for text
 * @param text - The text to count tokens for
 * @param model - The model name
 * @returns Number of tokens
 */
function countTextTokens(text: string, model: string = DEFAULT_MODEL): number {
  try {
    const encoding = encoding_for_model(model as TiktokenModel);
    const tokens = encoding.encode(text);
    encoding.free();
    return tokens.length;
  } catch (error) {
    // Fallback: rough estimation (1 token ≈ 4 characters)
    return Math.ceil(text.length / 4);
  }
}

/**
 * Calculates the number of tokens for an image based on OpenAI's official vision token calculation
 * Reference: https://platform.openai.com/docs/guides/vision
 *
 * 
 * 1. Image is resized to fit within 2048x2048 square (maintaining aspect ratio)
 * 2. Image is scaled such that the shortest side is 768px
 * 3. Image is divided into 512x512 tiles
 * 4. Token cost = 85 (base) + 170 * (number of tiles)
 *
 * @param imagePath - Path to the image file
 * @param model - The model to use for estimation
 * @returns Estimated number of image tokens
 */
async function countImageTokens(
  imagePath: string,
  model: string,
): Promise<number> {

  try {
    // Get image dimensions
    const metadata = await sharp(imagePath).metadata();

    let width = metadata.width || 0;
    let height = metadata.height || 0;

    // Calculate raw patches (32x32 blocks)
    let rawPatches = Math.ceil(width / 32) * Math.ceil(height / 32);

    // If patches exceed threshold, recalculate based on scaling ratio
    if (rawPatches >= 1536) {
      // Calculate the scaling ratio needed to bring patches to 1536
      let shrink_factor = Math.sqrt((32 ** 2 * 1536) / (width * height));

      // Adjust ratio to account for rounding in patch calculation
      shrink_factor =
        shrink_factor *
        Math.min(
          Math.floor((width * shrink_factor) / 32) /
            ((width * shrink_factor) / 32),
          Math.floor((height * shrink_factor) / 32) /
            ((height * shrink_factor) / 32)
        );

      // Recalculate dimensions after scaling
      const scaledWidth = width * shrink_factor;
      const scaledHeight = height * shrink_factor;

      // Recalculate patches with new dimensions
      rawPatches = Math.ceil(scaledWidth / 32) * Math.ceil(scaledHeight / 32);
    }

    // Use the calculated (or recalculated) patches
    const image_tokens = rawPatches;

    // Apply model-specific multiplier from models config
    const multiplier = getImageTokenMultiplier(model);

    // Final token calculation: base tokens + image tokens with multiplier
    const totalTokens = Math.ceil(image_tokens * multiplier + 85);

    return totalTokens;
  } catch (error) {
    throw new Error(`Failed to process image for token count: ${error}`);
  }
}

/**
 * Estimates the total tokens and cost for analyzing a frame
 * @param imagePath - Path to the image
 * @param prompt - The prompt text
 * @param model - The model to use (default: gpt-5-nano)
 * @returns Token estimate with cost
 */
async function estimateFrameTokens(
  imagePath: string,
  prompt: string,
  model: string = DEFAULT_MODEL
): Promise<TokenEstimate> {
  const textTokens = countTextTokens(prompt, model);
  const imageTokens = await countImageTokens(imagePath, model);
  const totalTokens = textTokens + imageTokens;

  // Estimate output cost (typically 50-100 tokens for brief descriptions)
  const estimatedOutputTokens = 100;

  // Use calculateCost from models for consistent pricing
  const estimatedCost = calculateCost(totalTokens, estimatedOutputTokens, model);

  return {
    textTokens,
    imageTokens,
    totalTokens,
    estimatedCost,
    model,
  };
}

/**
 * Estimates the total tokens and cost for analyzing multiple frames
 * @param imagePaths - Array of image paths
 * @param prompt - The prompt text (same for all)
 * @param model - The model to use
 * @returns Total token estimate with cost breakdown
 */
async function estimateFramesTokens(
  imagePaths: string[],
  prompt: string,
  model: string = DEFAULT_MODEL
): Promise<{
  perFrame: TokenEstimate;
  total: TokenEstimate;
  frameCount: number;
}> {
  // Calculate for first frame
  const firstFrameEstimate = await estimateFrameTokens(
    imagePaths[0],
    prompt,
    model,
  );

  // Multiply by number of frames
  const total: TokenEstimate = {
    textTokens: firstFrameEstimate.textTokens * imagePaths.length,
    imageTokens: firstFrameEstimate.imageTokens * imagePaths.length,
    totalTokens: firstFrameEstimate.totalTokens * imagePaths.length,
    estimatedCost: firstFrameEstimate.estimatedCost * imagePaths.length,
    model,
  };

  return {
    perFrame: firstFrameEstimate,
    total,
    frameCount: imagePaths.length,
  };
}

export {
  estimateFrameTokens,
  estimateFramesTokens,
  countTextTokens,
  countImageTokens,
};

export type { TokenEstimate };
