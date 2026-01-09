import { analyzeFrames } from "./frame-analyzers.js";
import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import path from "path";
import { promisify } from "util";
import OpenAI from "openai";
import { DEFAULT_MODEL, DEFAULT_SCALE } from "./constants.js";
import { getLogger } from "./logger.js";

const mkdir = promisify(fs.mkdir);
const unlink = promisify(fs.unlink);
const readdir = promisify(fs.readdir);

interface FrameData {
  frameNumber: number;
  timestamp: number;
  description: string;
  imageData: string; // base64 encoded image data
}

class SemanticVideo {
  private videoPath: string;
  private apiKey: string;
  private openaiClient: OpenAI;
  private frames: FrameData[] = [];
  private videoDuration: number = 0;
  private framesDir: string = "";
  private inputTokensUsed: number = 0;
  private outputTokensUsed: number = 0;
  private modelUsed: string = DEFAULT_MODEL;

  /**
   * Creates a SemanticVideo instance
   * @param videoPath - Path to the local video file
   * @param apiKey - OpenAI API key for frame analysis
   * @param openaiClient - Pre-initialized OpenAI client
   */
  constructor(videoPath: string, apiKey: string, openaiClient: OpenAI) {
    if (!fs.existsSync(videoPath)) {
      throw new Error(`Video file not found: ${videoPath}`);
    }
    if (!openaiClient) {
      throw new Error("OpenAI client is required");
    }

    this.videoPath = videoPath;
    this.apiKey = apiKey;
    this.openaiClient = openaiClient;
  }

  /**
   * Gets the duration of the video in seconds
   * @returns Promise that resolves with the video duration
   */
  private async getVideoDuration(): Promise<number> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(this.videoPath, (err, metadata) => {
        if (err) {
          reject(new Error(`Failed to get video duration: ${err.message}`));
        } else {
          const duration = metadata.format.duration || 0;
          resolve(duration);
        }
      });
    });
  }

  /**
   * Extracts frames from the video at specified timestamps (FAST - seeks directly to timestamps)
   * @param numPartitions - Number of frames to extract
   * @param quality - JPEG quality (2-31, lower is better quality but larger file. Default: 10 for balanced quality/size)
   * @param scale - Height in pixels for output frames (default: 720). Use -1 to keep original resolution.
   * @returns Promise that resolves with an array of base64 encoded frames
   */
  private async extractFrames(numPartitions: number, quality: number = 10, scale: number = DEFAULT_SCALE): Promise<string[]> {
    // Create unique temporary directory for this video to avoid conflicts during concurrent processing
    const videoBaseName = path.basename(this.videoPath, path.extname(this.videoPath));
    const uniqueId = Date.now() + '-' + Math.random().toString(36).substring(7);
    const tempDir = path.join(process.cwd(), ".semantic-video-frames-temp", `${videoBaseName}-${uniqueId}`);
    this.framesDir = tempDir;

    if (!fs.existsSync(tempDir)) {
      await mkdir(tempDir, { recursive: true });
    }

    // Calculate timestamps for each frame
    const interval = this.videoDuration / numPartitions;
    const timestamps: number[] = [];
    for (let i = 0; i < numPartitions; i++) {
      timestamps.push(i * interval);
    }

    const scaleInfo = scale === -1 ? 'original resolution' : `${scale}p`;
    const logger = getLogger();
    logger.logFrameExtraction(numPartitions, quality, scaleInfo);

    // Extract each frame at its specific timestamp (parallel processing)
    const extractionPromises = timestamps.map((timestamp, index) => {
      return this.extractSingleFrame(timestamp, index, tempDir, quality, scale);
    });

    try {
      // Wait for all frames to be extracted
      const base64Frames = await Promise.all(extractionPromises);
      return base64Frames;
    } catch (error) {
      throw new Error(`Failed to extract frames: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Extracts a single frame at a specific timestamp
   * @param timestamp - The timestamp in seconds
   * @param index - The frame index
   * @param tempDir - Temporary directory for output
   * @param quality - JPEG quality (2-31, lower is better quality but larger file. Default: 10 for balanced quality/size)
   * @param scale - Height in pixels for output frame (default: 720). Use -1 to keep original resolution.
   * @returns Promise that resolves with base64 encoded frame
   */
  private async extractSingleFrame(
    timestamp: number,
    index: number,
    tempDir: string,
    quality: number = 10,
    scale: number = DEFAULT_SCALE
  ): Promise<string> {
    const outputPath = path.join(tempDir, `frame_${String(index + 1).padStart(4, '0')}.jpg`);

    // Build output options based on parameters
    const outputOptions = [`-q:v ${quality}`]; // JPEG quality (10 = good balance, 2 = near lossless, 31 = lowest quality)
    if (scale !== -1) {
      outputOptions.push(`-vf scale=-2:${scale}`); // Resize to specified height (maintains aspect ratio)
    }

    return new Promise((resolve, reject) => {
      ffmpeg(this.videoPath)
        .seekInput(timestamp)
        .frames(1) 
        .output(outputPath)
        .outputOptions(outputOptions)
        .on("end", () => {
          try {
            const buffer = fs.readFileSync(outputPath);
            const base64 = buffer.toString("base64");
            resolve(base64);
          } catch (error) {
            reject(error);
          }
        })
        .on("error", (err) => {
          reject(new Error(`Failed to extract frame at ${timestamp}s: ${err.message}`));
        })
        .run();
    });
  }

  /**
   * Analyzes the video by extracting frames and getting AI descriptions
   * @param numPartitions - Number of frames to extract and analyze (e.g., 10 for a 10-second video = 1 frame/second)
   * @param prompt - Optional custom prompt for frame analysis
   * @param quality - JPEG quality (2-31, lower is better quality but uses more tokens. Default: 10 for balanced quality/cost)
   * @param scale - Height in pixels for output frames (default: 720). Use -1 to keep original resolution.
   * @param model - Model to use for analysis
   * @param maxFrameConcurrency - Maximum number of frames to analyze concurrently (default: 5)
   * @returns Promise that resolves when analysis is complete
   */
  async analyze(
    numPartitions: number = 10,
    prompt?: string,
    quality: number = 10,
    scale: number = DEFAULT_SCALE,
    model: string = DEFAULT_MODEL,
    maxFrameConcurrency: number = 5
  ): Promise<FrameData[]> {
    try {

      this.videoDuration = await this.getVideoDuration();

      const base64Frames = await this.extractFrames(numPartitions, quality, scale);

      const tempDir = this.framesDir;
      const tempFramePaths = base64Frames.map((base64, index) => {
        const framePath = path.join(tempDir, `frame_${String(index + 1).padStart(4, '0')}.jpg`);
        const buffer = Buffer.from(base64, 'base64');
        fs.writeFileSync(framePath, buffer);
        return framePath;
      });

      const logger = getLogger();
      logger.logAIAnalysis(base64Frames.length, model);
      const { descriptions, totalInputTokens, totalOutputTokens } = await analyzeFrames(tempFramePaths, this.apiKey, prompt, this.openaiClient, model, maxFrameConcurrency);

      // Store tokens and model used
      this.inputTokensUsed = totalInputTokens;
      this.outputTokensUsed = totalOutputTokens;
      this.modelUsed = model;

      // Store frame data with base64 images (not file paths)
      this.frames = base64Frames.map((base64, index) => ({
        frameNumber: index + 1,
        timestamp: (this.videoDuration / numPartitions) * index,
        description: descriptions[index],
        imageData: base64,
      }));

      // Clean up temporary files immediately after analysis
      await this.cleanup();

      return this.frames;
    } catch (error) {
      // Clean up on error too
      await this.cleanup();
      
      if (error instanceof Error) {
        throw new Error(`Failed to analyze video: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Gets the tokens used for this video's analysis
   * @returns Object with input and output tokens used (0 if not yet analyzed)
   */
  getTokensUsed(): { inputTokens: number; outputTokens: number; totalTokens: number; model: string } {
    return {
      inputTokens: this.inputTokensUsed,
      outputTokens: this.outputTokensUsed,
      totalTokens: this.inputTokensUsed + this.outputTokensUsed,
      model: this.modelUsed,
    };
  }

  /**
   * Gets all analyzed frames with their descriptions
   * @returns Array of frame data
   */
  getFrames(): FrameData[] {
    return this.frames;
  }

  /**
   * Gets a specific frame by frame number
   * @param frameNumber - The frame number (1-indexed)
   * @returns The frame data or undefined if not found
   */
  getFrame(frameNumber: number): FrameData | undefined {
    return this.frames.find((f) => f.frameNumber === frameNumber);
  }

  /**
   * Searches frames by keyword in descriptions
   * @param keyword - The keyword to search for
   * @returns Array of matching frames
   */
  searchFrames(keyword: string): FrameData[] {
    const lowerKeyword = keyword.toLowerCase();
    return this.frames.filter((f) =>
      f.description.toLowerCase().includes(lowerKeyword)
    );
  }

  /**
   * Gets the video duration in seconds
   * @returns The video duration
   */
  getDuration(): number {
    return this.videoDuration;
  }

    /**
   * Gets the video duration in seconds
   * @returns The video duration
   */
  getFramesCount(): number {
    return this.frames.length;
  }
  
  /**
   * Gets a frame image as base64 data URL (ready to use in <img> tags)
   * @param frameNumber - The frame number (1-indexed)
   * @returns Data URL string or undefined if frame not found
   */
  getFrameImageDataUrl(frameNumber: number): string | undefined {
    const frame = this.frames.find((f) => f.frameNumber === frameNumber);
    if (frame) {
      return `data:image/jpeg;base64,${frame.imageData}`;
    }
    return undefined;
  }

  /**
   * Gets a frame image as base64 string
   * @param frameNumber - The frame number (1-indexed)
   * @returns Base64 string or undefined if frame not found
   */
  getFrameImageBase64(frameNumber: number): string | undefined {
    const frame = this.frames.find((f) => f.frameNumber === frameNumber);
    return frame?.imageData;
  }

  /**
   * Saves a frame to disk as a JPEG file
   * @param frameNumber - The frame number (1-indexed)
   * @param outputPath - Path where to save the image
   */
  saveFrame(frameNumber: number, outputPath: string): void {
    const frame = this.frames.find((f) => f.frameNumber === frameNumber);
    if (!frame) {
      throw new Error(`Frame ${frameNumber} not found`);
    }
    
    const buffer = Buffer.from(frame.imageData, 'base64');
    fs.writeFileSync(outputPath, buffer);
  }

  /**
   * Cleans up temporary frame files
   */
  async cleanup(): Promise<void> {
    if (this.framesDir && fs.existsSync(this.framesDir)) {
      try {
        const files = await readdir(this.framesDir);
        for (const file of files) {
          await unlink(path.join(this.framesDir, file));
        }
        fs.rmdirSync(this.framesDir);
        this.framesDir = "";
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  }
}

export default SemanticVideo;
export type { FrameData };
