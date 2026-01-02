import SemanticVideo from "./semantic-video.js";
import OpenAI from "openai";

/**
 * Manages the storage and retrieval of SemanticVideo instances
 */
class VideoRegistry {
  private videos: Map<string, SemanticVideo> = new Map();
  private apiKey: string;
  private openaiClient: OpenAI;

  constructor(apiKey: string, openaiClient: OpenAI) {
    this.apiKey = apiKey;
    this.openaiClient = openaiClient;
  }

  /**
   * Creates and registers a new SemanticVideo instance
   * @param videoPath - Path to the local video file
   * @returns The created SemanticVideo instance
   */
  create(videoPath: string): SemanticVideo {
    const video = new SemanticVideo(videoPath, this.apiKey, this.openaiClient);
    this.videos.set(videoPath, video);
    return video;
  }

  /**
   * Gets a video instance by path
   * @param videoPath - Path to the video file
   * @returns The SemanticVideo instance or undefined
   */
  get(videoPath: string): SemanticVideo | undefined {
    return this.videos.get(videoPath);
  }

  /**
   * Gets or creates a video instance
   * @param videoPath - Path to the video file
   * @returns The SemanticVideo instance
   */
  getOrCreate(videoPath: string): SemanticVideo {
    let video = this.videos.get(videoPath);
    if (!video) {
      video = this.create(videoPath);
    }
    return video;
  }

  /**
   * Gets all registered videos
   * @returns Map of all video instances
   */
  getAll(): Map<string, SemanticVideo> {
    return this.videos;
  }

  /**
   * Removes a video from the registry
   * @param videoPath - Path to the video file
   * @returns True if removed, false if not found
   */
  remove(videoPath: string): boolean {
    return this.videos.delete(videoPath);
  }

  /**
   * Clears all videos from the registry
   */
  clear(): void {
    this.videos.clear();
  }

  /**
   * Gets the count of registered videos
   */
  get count(): number {
    return this.videos.size;
  }

  /**
   * Iterates over all videos
   */
  forEach(callback: (video: SemanticVideo, path: string) => void): void {
    this.videos.forEach(callback);
  }
}

export default VideoRegistry;
