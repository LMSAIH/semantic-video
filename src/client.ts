import SemanticVideo, { FrameData } from "./semantic-video.js";
import OpenAI from "openai";
import VideoRegistry from "./video-registry.js";
import StatsTracker, { ClientStats } from "./stats-tracker.js";
import TokenEstimator, {
  type VideoTokenEstimate,
  type MultiVideoTokenEstimate,
} from "./token-estimator.js";
import VideoSearch, { SearchResult } from "./video-search.js";
import { DEFAULT_MODEL, DEFAULT_PROMPT, DEFAULT_SCALE } from "./constants.js";
import { getLogger, LoggerOptions } from "./logger.js";

interface VideoAnalysisResult {
  inputTokensUsed: number;
  outputTokensUsed: number;
  modelUsed: string;
  videoDuration: number;
  error?: string;
  frames: FrameData[];
  videoPath: string;
}

class SemanticVideoClient {
  private apiKey: string;
  private openaiClient: OpenAI;
  private registry: VideoRegistry;
  private stats: StatsTracker;
  private estimator: TokenEstimator;
  private search: VideoSearch;
  private maxConcurrency: number;
  private maxFrameConcurrency: number;

  /**
   * Creates a SemanticVideoClient instance
   * @param apiKey - OpenAI API key for frame analysis
   * @param loggerOptions - Optional logger configuration
   * @param maxConcurrency - Maximum number of videos to process concurrently (default: 3)
   * @param maxFrameConcurrency - Maximum number of frames to analyze concurrently per video (default: 5)
   */
  constructor(
    apiKey: string,
    loggerOptions?: LoggerOptions,
    maxConcurrency: number = 3,
    maxFrameConcurrency: number = 5
  ) {
    if (!apiKey) {
      throw new Error("API key is required");
    }
    this.apiKey = apiKey;
    this.openaiClient = new OpenAI({ apiKey });
    this.registry = new VideoRegistry(apiKey, this.openaiClient);
    this.stats = new StatsTracker();
    this.estimator = new TokenEstimator();
    this.search = new VideoSearch();
    this.maxConcurrency = Math.max(1, maxConcurrency);
    this.maxFrameConcurrency = Math.max(1, maxFrameConcurrency);
    // Initialize logger with options
    getLogger(loggerOptions);
  }

  /**
   * Creates and registers a new SemanticVideo instance
   * @param videoPath - Path to the local video file
   * @returns The created SemanticVideo instance
   */
  createVideo(videoPath: string): SemanticVideo {
    return this.registry.create(videoPath);
  }

  /**
   * Analyzes a single video
   * @param videoPath - Path to the video file
   * @param numPartitions - Number of frames to extract
   * @param prompt - Optional custom prompt
   * @param quality - JPEG quality (2-31, lower is better quality but uses more tokens. Default: 10)
   * @param scale - Height in pixels for output frames (default: 720). Use -1 to keep original resolution.
   * @param model - Model to use for analysis (default: gpt-5-nano)
   * @returns Promise that resolves with the analyzed frames
   */
  async analyzeVideo(
    videoPath: string,
    numPartitions: number = 10,
    prompt?: string,
    quality: number = 10,
    scale: number = DEFAULT_SCALE,
    model: string = DEFAULT_MODEL
  ): Promise<FrameData[]> {
    const video = this.registry.getOrCreate(videoPath);
    return await video.analyze(numPartitions, prompt, quality, scale, model, this.maxFrameConcurrency);
  }

  /**
   * Analyzes multiple videos concurrently
   * @param videoConfigs - Array of video configurations
   * @returns Promise that resolves with results for all videos
   */
  async analyzeMultipleVideos(
    videoConfigs: Array<{
      videoPath: string;
      numPartitions?: number;
      prompt?: string;
      quality?: number;
      scale?: number;
      model?: string;
    }>
  ): Promise<VideoAnalysisResult[]> {
    const logger = getLogger();
    logger.initBatch(videoConfigs.length);
    const startTime = Date.now();

    const processVideo = async (config: typeof videoConfigs[0]): Promise<VideoAnalysisResult> => {
      try {
        logger.updateVideo(config.videoPath, "processing", "Starting analysis", 0);

        const video = this.registry.getOrCreate(config.videoPath);
        const frames = await video.analyze(
          config.numPartitions || 10,
          config.prompt,
          config.quality || 10,
          config.scale || DEFAULT_SCALE,
          config.model || DEFAULT_MODEL,
          this.maxFrameConcurrency
        );

        const { inputTokens, outputTokens, model } = video.getTokensUsed();
        logger.completeVideo(config.videoPath, frames.length, inputTokens, outputTokens, model);

        return {
          inputTokensUsed: inputTokens,
          outputTokensUsed: outputTokens,
          modelUsed: model,
          videoDuration: video.getDuration(),
          frames,
          videoPath: config.videoPath,
        };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger.failVideo(config.videoPath, errorMsg);

        const video = this.registry.get(config.videoPath);
        const { inputTokens, outputTokens, model } = video?.getTokensUsed() || {
          inputTokens: 0,
          outputTokens: 0,
          model: DEFAULT_MODEL,
        };

        return {
          inputTokensUsed: inputTokens,
          outputTokensUsed: outputTokens,
          modelUsed: model,
          videoDuration: video?.getDuration() || 0,
          error: errorMsg,
          frames: [],
          videoPath: config.videoPath,
        };
      }
    };

    // Process videos with dynamic concurrency - as one finishes, start the next
    const results: VideoAnalysisResult[] = [];
    const executing: Set<Promise<void>> = new Set();

    for (const config of videoConfigs) {
      const promise = processVideo(config).then((result) => {
        results.push(result);
        if (!result.error) {
          this.stats.recordAnalysis(
            result.inputTokensUsed,
            result.outputTokensUsed,
            result.frames.length,
            result.modelUsed
          );
        }
      }).finally(() => {
        executing.delete(promise);
      });

      executing.add(promise);

      if (executing.size >= this.maxConcurrency) {
        await Promise.race(executing);
      }
    }

    await Promise.all(Array.from(executing));

    const totalDuration = Date.now() - startTime;
    const successful = results.filter((r) => !r.error).length;
    const failed = results.filter((r) => r.error).length;

    logger.completeBatch(totalDuration, successful, failed);

    return results;
  }

  /**
   * Gets a video instance by path
   * @param videoPath - Path to the video file
   * @returns The SemanticVideo instance or undefined
   */
  getVideo(videoPath: string): SemanticVideo | undefined {
    return this.registry.get(videoPath);
  }

  /**
   * Gets all registered videos
   * @returns Map of all video instances
   */
  getAllVideos(): Map<string, SemanticVideo> {
    return this.registry.getAll();
  }

  /**
   * Searches across all videos for frames matching a keyword
   * @param keyword - The keyword to search for
   * @returns Array of results with video path and matching frames
   */
  searchAllVideos(keyword: string): SearchResult[] {
    return this.search.searchAll(keyword, (callback) => {
      this.registry.forEach(callback);
    });
  }

  /**
   * Gets statistics about all processed videos
   * @returns Statistics object
   */
  getStats(): ClientStats {
    return this.stats.getStats((callback) => {
      this.registry.forEach((video) => callback(video));
    });
  }

  /**
   * Removes a video from the client
   * @param videoPath - Path to the video file
   * @returns True if removed, false if not found
   */
  removeVideo(videoPath: string): boolean {
    return this.registry.remove(videoPath);
  }

  /**
   * Clears all videos from the client
   */
  clearAll(): void {
    this.registry.clear();
  }

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
  async estimateVideoTokens(
    videoPath: string,
    numPartitions: number = 10,
    prompt: string = DEFAULT_PROMPT,
    model: string = DEFAULT_MODEL,
    quality: number = 10,
    scale: number = 720
  ): Promise<VideoTokenEstimate> {
    return this.estimator.estimateVideo(
      videoPath,
      numPartitions,
      prompt,
      model,
      quality,
      scale
    );
  }

  /**
   * Estimates tokens and cost for analyzing multiple videos
   * @param videoConfigs - Array of video configurations
   * @returns Token estimate for all videos
   */
  async estimateMultipleVideosTokens(
    videoConfigs: Array<{
      videoPath: string;
      numPartitions?: number;
      prompt?: string;
      quality?: number;
      scale?: number;
      model?: string;
    }>
  ): Promise<MultiVideoTokenEstimate> {
    return this.estimator.estimateMultipleVideos(videoConfigs);
  }

  /**
   * Configures logger options
   * @param options - Logger configuration options
   */
  configureLogger(options: LoggerOptions): void {
    getLogger().setOptions(options);
  }
}

export default SemanticVideoClient;
export type {
  VideoAnalysisResult,
  VideoTokenEstimate,
  MultiVideoTokenEstimate,
  LoggerOptions,
};
