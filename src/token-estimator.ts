import fs from "fs";
import path from "path";
import ffmpeg from "fluent-ffmpeg";
import { estimateFramesTokens, type TokenEstimate } from "./token-estimate.js";
import {DEFAULT_MODEL, DEFAULT_PROMPT, DEFAULT_SCALE} from "./constants.js";
import { getLogger } from "./logger.js";
import Table from 'cli-table3';
import { getModelPricing } from "./models.js";

export type VideoTokenEstimate = {
  videoPath: string;
  numPartitions: number;
  perFrame: TokenEstimate;
  total: TokenEstimate;
  model: string;
}

export type MultiVideoTokenEstimate = {
  videos: VideoTokenEstimate[];
  grandTotal: {
    totalTokens: number;
    estimatedCost: number;
  };
  elapsedTime?: number;
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
    scale: number = DEFAULT_SCALE
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
        model,
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

    const startTime = Date.now();
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
          config.scale || DEFAULT_SCALE
        );

        videoEstimates.push(estimate);
        totalTokens += estimate.total.totalTokens;
        totalCost += estimate.total.estimatedCost;
      } catch (error) {
        const logger = getLogger();
        logger.warn(`Could not estimate for ${config.videoPath}: ${error}`);
      }
    }

    const elapsedTime = Date.now() - startTime;
    
    const result = {
      videos: videoEstimates,
      grandTotal: {
        totalTokens,
        estimatedCost: totalCost,
      },
      elapsedTime,
    };

    // Auto-display if logger is enabled and showEstimateTables is true
    const logger = getLogger();
    if (logger.shouldShowEstimateTables()) {
      this.displayEstimate(result);
    }

    return result;
  }

  /**
   * Displays token estimate in a formatted table
   * @param estimate - Single video estimate or multi-video estimate
   */
  displayEstimate(estimate: VideoTokenEstimate | MultiVideoTokenEstimate): void {
    console.log('');
    console.log('═'.repeat(70));
    console.log('[ESTIMATE] TOKEN & COST ESTIMATION');
    console.log('═'.repeat(70));

    const table = new Table({
      head: ['File', 'Frames', 'Model', 'Tokens/Frame', 'Total Tokens', 'Est. Cost', 'Input $/M', 'Output $/M'],
      style: { head: [], border: [] }
    });

    // Normalize to array format
    const videos = 'videos' in estimate ? estimate.videos : [estimate];
    const grandTotal = 'grandTotal' in estimate ? estimate.grandTotal : {
      totalTokens: estimate.total.totalTokens,
      estimatedCost: estimate.total.estimatedCost
    };
    const elapsedTime = 'elapsedTime' in estimate ? estimate.elapsedTime : undefined;

    // Add each video row
    videos.forEach(video => {
      const videoName = video.videoPath.split(/[/\\]/).pop() || video.videoPath;
      const model = video.model; 
      
      let inputPrice = 0.15;
      let outputPrice = 0.6;
      try {
        const pricing = getModelPricing(model);
        inputPrice = pricing.inputCostPerMillion;
        outputPrice = pricing.outputCostPerMillion;
      } catch {}

      table.push([
        videoName,
        video.numPartitions,
        model,
        video.perFrame.totalTokens.toLocaleString(),
        video.total.totalTokens.toLocaleString(),
        `$${video.total.estimatedCost.toFixed(6)}`,
        `$${inputPrice.toFixed(2)}`,
        `$${outputPrice.toFixed(2)}`
      ]);
    });

    // Add totals row if multiple videos
    if (videos.length > 1) {
      table.push([
        `TOTAL (${videos.length} videos)`,
        '-',
        '-',
        '-',
        grandTotal.totalTokens.toLocaleString(),
        `$${grandTotal.estimatedCost.toFixed(6)}`,
        '-',
        '-'
      ]);
    }

    console.log(table.toString());
    
    // Show elapsed time if available
    if (elapsedTime !== undefined) {
      const seconds = (elapsedTime / 1000).toFixed(2);
      console.log(`Estimation Time: ${seconds}s`);
    }
    
    console.log('═'.repeat(70));
    console.log('');
  }
}

export default TokenEstimator;
