import SemanticVideo from "./semantic-video.js";
import { calculateCost } from "./models.js";
import { DEFAULT_MODEL } from "./constants.js";

type ClientStats = {
  totalVideos: number;
  totalFrames: number;
  totalDuration: number;
  averageFramesPerVideo: number;
  totalTokensUsed: number;
  totalCostIncurred: number;
  totalApiCalls: number;
  averageTokensPerVideo: number;
  averageTokensPerFrame: number;
};

/**
 * Tracks usage statistics for video analysis
 */
class StatsTracker {
  private totalTokensUsed: number = 0;
  private totalCostIncurred: number = 0;
  private totalApiCalls: number = 0;

  /**
   * Records tokens used from a video analysis
   * @param inputTokens - Number of input tokens used
   * @param outputTokens - Number of output tokens used
   * @param frameCount - Number of frames analyzed
   * @param model - The model used for analysis (default: gpt-5-nano)
   */
  recordAnalysis(
    inputTokens: number,
    outputTokens: number,
    frameCount: number,
    model: string = DEFAULT_MODEL
  ): void {
    const totalTokens = inputTokens + outputTokens;
    this.totalTokensUsed += totalTokens;
    this.totalApiCalls += frameCount;

    // Use calculateCost from models for consistent pricing
    this.totalCostIncurred += calculateCost(inputTokens, outputTokens, model);
  }

  /**
   * Gets comprehensive statistics
   * @param videos - Iterator function to get video stats
   * @returns Statistics object
   */
  getStats(videoIterator: (callback: (video: SemanticVideo) => void) => void): ClientStats {
    let totalVideos = 0;
    let totalFrames = 0;
    let totalDuration = 0;

    videoIterator((video) => {
      totalVideos++;
      totalFrames += video.getFramesCount();
      totalDuration += video.getDuration();
    });

    return {
      totalVideos,
      totalFrames,
      totalDuration,
      averageFramesPerVideo: totalVideos > 0 ? totalFrames / totalVideos : 0,
      totalTokensUsed: this.totalTokensUsed,
      totalCostIncurred: this.totalCostIncurred,
      totalApiCalls: this.totalApiCalls,
      averageTokensPerVideo: totalVideos > 0 ? this.totalTokensUsed / totalVideos : 0,
      averageTokensPerFrame: totalFrames > 0 ? this.totalTokensUsed / totalFrames : 0,
    };
  }

  /**
   * Gets the total tokens used
   */
  get tokens(): number {
    return this.totalTokensUsed;
  }

  /**
   * Gets the total cost incurred
   */
  get cost(): number {
    return this.totalCostIncurred;
  }

  /**
   * Gets the total API calls made
   */
  get apiCalls(): number {
    return this.totalApiCalls;
  }

  /**
   * Resets all statistics
   */
  reset(): void {
    this.totalTokensUsed = 0;
    this.totalCostIncurred = 0;
    this.totalApiCalls = 0;
  }
}

export default StatsTracker;
export type { ClientStats };
