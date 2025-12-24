import fs from "fs";
import path from "path";
import ffmpeg from "fluent-ffmpeg";
import { estimateFramesTokens, type TokenEstimate } from "./token-estimate";
import {DEFAULT_MODEL, DEFAULT_PROMPT} from "./constants";

type VideoTokenEstimate = {
  videoPath: string;
  numPartitions: number;
  perFrame: TokenEstimate;
  total: TokenEstimate;
}

type MultiVideoTokenEstimate = {
  videos: VideoTokenEstimate[];
  grandTotal: {
    totalTokens: number;
    estimatedCost: number;
  };
}

/**
 * Handles token estimation for video analysis
 */
class TokenEstimator {
  /**
   * Estimates tokens and cost for analyzing a single video
   * @param videoPath - Path to the video file
   * @param numPartitions - Number of frames to extract
   * @param prompt - Optional custom prompt
   * @param model - Model to use (default: gpt-5-nano)
   * @param quality - Quality setting for frame extraction
   * @param scale - Height in pixels for output frames (default: 720)
   * @returns Token estimate for the video
   */
  async estimateVideo(
    videoPath: string,
    numPartitions: number = 10,
    prompt: string = DEFAULT_PROMPT,
    model: string = DEFAULT_MODEL,
    quality: number = 10,
    scale: number = 720
  ): Promise<VideoTokenEstimate> {
    
    if (!fs.existsSync(videoPath)) {
      throw new Error(`Video file not found: ${videoPath}`);
    }

    // Extract a sample frame to get accurate token estimation
    const tempDir = path.join(process.cwd(), ".semantic-video-estimate-temp");
    const sampleFramePath = path.join(tempDir, "sample_frame.jpg");

    try {
      // Create temp directory
      if (!fs.existsSync(tempDir)) {
        await fs.promises.mkdir(tempDir, { recursive: true });
      }

      // Build output options based on parameters
      const outputOptions = [`-q:v ${quality}`];
      if (scale !== -1) {
        outputOptions.push(`-vf scale=-2:${scale}`);
      }

      // Extract one frame from the middle of the video for estimation
      await new Promise<void>((resolve, reject) => {
        ffmpeg(videoPath)
          .seekInput(1) // Extract frame at 1 second
          .frames(1)
          .output(sampleFramePath)
          .outputOptions(outputOptions)
          .on("end", () => resolve())
          .on("error", (err) => reject(err))
          .run();
      });

      // Calculate tokens based on the actual extracted frame
      const framePaths = Array(numPartitions).fill(sampleFramePath);
      const estimate = await estimateFramesTokens(framePaths, prompt, model);

      // Clean up
      await fs.promises.unlink(sampleFramePath).catch(() => {});
      await fs.promises.rmdir(tempDir).catch(() => {});

      return {
        videoPath,
        numPartitions,
        perFrame: estimate.perFrame,
        total: estimate.total,
      };
    } catch (error) {
      // Clean up on error
      try {
        await fs.promises.unlink(sampleFramePath).catch(() => {});
        await fs.promises.rmdir(tempDir).catch(() => {});
      } catch {}

      throw new Error(`Failed to estimate tokens: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Estimates tokens and cost for analyzing multiple videos
   * @param videoConfigs - Array of video configurations
   * @returns Token estimate for all videos
   */
  async estimateMultipleVideos(
    videoConfigs: Array<{
      videoPath: string;
      numPartitions?: number;
      prompt?: string;
      quality?: number;
      scale?: number;
      model?: string;
    }>
  ): Promise<MultiVideoTokenEstimate> {

    const videoEstimates: VideoTokenEstimate[] = [];
    let totalTokens = 0;
    let totalCost = 0;

    for (const config of videoConfigs) {
      try {
        const estimate = await this.estimateVideo(
          config.videoPath,
          config.numPartitions || 10,
          config.prompt || DEFAULT_PROMPT,
          config.model || DEFAULT_MODEL,
          config.quality || 10,
          config.scale || 720
        );

        videoEstimates.push(estimate);
        totalTokens += estimate.total.totalTokens;
        totalCost += estimate.total.estimatedCost;
      } catch (error) {
        console.warn(`Warning: Could not estimate for ${config.videoPath}: ${error}`);
      }
    }

    return {
      videos: videoEstimates,
      grandTotal: {
        totalTokens,
        estimatedCost: totalCost,
      },
    };
  }
}

export default TokenEstimator;
export type { VideoTokenEstimate, MultiVideoTokenEstimate };
