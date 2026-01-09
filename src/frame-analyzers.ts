import OpenAI from "openai";
import fs from "fs";
import path from "path";
import {DEFAULT_PROMPT, DEFAULT_MODEL} from "./constants.js";

/**
 * Analyzes an image using OpenAI's vision model
 * @param imagePath - Local path to the image file
 * @param apiKey - OpenAI API key
 * @param prompt - Optional prompt/question about the image
 * @param client - Optional pre-initialized OpenAI client for better performance
 * @returns Object with the AI's response and token usage
 */
async function analyzeFrame(
  imagePath: string,
  apiKey: string,
  prompt: string = DEFAULT_PROMPT,
  client: OpenAI,
  model: string = DEFAULT_MODEL,
): Promise<{ content: string; inputTokens: number; outputTokens: number }> {
  try {
    if (!apiKey && !client) {
      throw new Error("API key or client is required");
    }

    const openaiClient = client || new OpenAI({ apiKey });

    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString("base64");

    const ext = path.extname(imagePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".gif": "image/gif",
      ".webp": "image/webp",
    };

    const mimeType = mimeTypes[ext] || "image/jpeg";
    const imageUrl = `data:${mimeType};base64,${base64Image}`;

    const response = await openaiClient.chat.completions.create({
      model,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: { url: imageUrl, detail: "high" },
            },
          ],
        },
      ],
    });

    const inputTokens = response.usage?.prompt_tokens || 0;
    const outputTokens = response.usage?.completion_tokens || 0;

    return {
      content: response.choices[0].message.content || "",
      inputTokens,
      outputTokens,
    };
  } catch (error) {
    throw error;
  }
}

/**
 * Analyzes multiple images and returns separate descriptions for each
 * @param imagePaths - Array of local paths to image files
 * @param apiKey - OpenAI API key
 * @param prompt - Prompt/question about each image
 * @param client - Optional pre-initialized OpenAI client for better performance
 * @param model - Model to use for analysis
 * @param maxConcurrency - Maximum number of frames to analyze concurrently (default: 5)
 * @returns Object with array of descriptions and total tokens used
 */
async function analyzeFrames(
  imagePaths: string[],
  apiKey: string,
  prompt: string = DEFAULT_PROMPT,
  client?: OpenAI,
  model: string = DEFAULT_MODEL,
  maxConcurrency: number = 5
): Promise<{ descriptions: string[]; totalInputTokens: number; totalOutputTokens: number }> {
  try {
    if (!apiKey && !client) {
      throw new Error("API key or client is required");
    }

    // Use provided client or create a new one
    const openaiClient = client || new OpenAI({ apiKey });

    const processFrame = async (imagePath: string, index: number) => {
      try {
        if (!fs.existsSync(imagePath)) {
          throw new Error(`File not found - ${imagePath}`);
        }

        const result = await analyzeFrame(
          imagePath,
          apiKey,
          prompt,
          openaiClient,
          model
        );
        return { index, result };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        throw new Error(`Frame ${index + 1} failed: ${errorMsg}`);
      }
    };

    // Process frames with dynamic concurrency
    const results: Array<{ index: number; result: { content: string; inputTokens: number; outputTokens: number } }> = [];
    const executing: Set<Promise<void>> = new Set();

    for (let i = 0; i < imagePaths.length; i++) {
      const promise = processFrame(imagePaths[i], i).then((res) => {
        results.push(res);
      }).finally(() => {
        executing.delete(promise);
      });

      executing.add(promise);

      if (executing.size >= maxConcurrency) {
        await Promise.race(executing);
      }
    }

    await Promise.all(executing);

    // Sort results by index to maintain order
    results.sort((a, b) => a.index - b.index);

    const descriptions = results.map((r) => r.result.content);
    const totalInputTokens = results.reduce((sum, r) => sum + r.result.inputTokens, 0);
    const totalOutputTokens = results.reduce((sum, r) => sum + r.result.outputTokens, 0);

    return { descriptions, totalInputTokens, totalOutputTokens };
  } catch (error) {
    throw error;
  }
}

export {
  analyzeFrame,
  analyzeFrames,
};