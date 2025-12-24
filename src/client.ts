import SemanticVideo, { FrameData } from "./semantic-video";
import OpenAI from "openai";
import VideoRegistry from "./video-registry";
import StatsTracker, { ClientStats } from "./stats-tracker";
import TokenEstimator, { VideoTokenEstimate, MultiVideoTokenEstimate } from "./token-estimator";
import VideoSearch, { SearchResult } from "./video-search";
import { DEFAULT_MODEL, DEFAULT_PROMPT } from "./constants";

interface VideoAnalysisResult {
  videoPath: string;
  video: SemanticVideo;
  frames: FrameData[];
  error?: string;
}

class SemanticVideoClient {
  private apiKey: string;
  private openaiClient: OpenAI;
  private registry: VideoRegistry;
  private stats: StatsTracker;
  private estimator: TokenEstimator;
  private search: VideoSearch;

  /**
   * Creates a SemanticVideoClient instance
   * @param apiKey - OpenAI API key for frame analysis
   */
  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error("API key is required");
    }
    this.apiKey = apiKey;
    this.openaiClient = new OpenAI({ apiKey });
    this.registry = new VideoRegistry(apiKey, this.openaiClient);
    this.stats = new StatsTracker();
    this.estimator = new TokenEstimator();
    this.search = new VideoSearch();
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
   * @param model - Model to use for analysis (default: gpt-5-nano)
   * @returns Promise that resolves with the analyzed frames
   */
  async analyzeVideo(
    videoPath: string,
    numPartitions: number = 10,
    prompt?: string,
    quality: number = 10,
    model: string = DEFAULT_MODEL
  ): Promise<FrameData[]> {
    const video = this.registry.getOrCreate(videoPath);
    return await video.analyze(numPartitions, prompt, quality, 720, model);
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
      model?: string;
    }>
  ): Promise<VideoAnalysisResult[]> {
    console.log(`\nStarting concurrent analysis of ${videoConfigs.length} videos...`);
    const startTime = Date.now();

    const promises = videoConfigs.map(async (config, index) => {
      const videoStartTime = Date.now();
      try {

        const video = this.registry.getOrCreate(config.videoPath);

        const frames = await video.analyze(
          config.numPartitions || 10,
          config.prompt,
          config.quality || 10,
          720,
          config.model || DEFAULT_MODEL
        );
        
        return {
          videoPath: config.videoPath,
          video,
          frames,
        };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        const duration = ((Date.now() - videoStartTime) / 1000).toFixed(2);
        console.error(`[video ${index + 1}] Failed after ${duration}s: ${config.videoPath}: ${errorMsg}`);
        
        return {
          videoPath: config.videoPath,
          video: this.registry.get(config.videoPath)!,
          frames: [],
          error: errorMsg,
        };
      }
    });

    const results = await Promise.all(promises);

    // Track tokens from all videos
    results.forEach((result) => {
      if (!result.error && result.video) {
        const { inputTokens, outputTokens, model } = result.video.getTokensUsed();
        this.stats.recordAnalysis(inputTokens, outputTokens, result.frames.length, model);
      }
    });

    const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);
    const successful = results.filter((r) => !r.error).length;
    const failed = results.filter((r) => r.error).length;

    console.log(`\nAnalysis complete in ${totalDuration}s: ${successful} successful, ${failed} failed`);

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
    return this.estimator.estimateVideo(videoPath, numPartitions, prompt, model, quality, scale);
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
}

export default SemanticVideoClient;
export type { VideoAnalysisResult, VideoTokenEstimate, MultiVideoTokenEstimate };
