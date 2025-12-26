/**
 * Professional logging system for SemanticVideo operations
 * Uses winston for logging and cli-table3 for table formatting
 */

import winston from 'winston';
import Table from 'cli-table3';
import { getModelPricing } from './models';

export interface LoggerOptions {
  enabled?: boolean;
  showProgress?: boolean;
  showTimestamps?: boolean;
  level?: 'minimal' | 'normal' | 'verbose';
  showEstimateTables?: boolean;
}

export interface VideoProgress {
  videoPath: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  stage: string;
  startTime?: number;
  endTime?: number;
  error?: string;
}

class Logger {
  private options: Required<LoggerOptions>;
  private videoProgress: Map<string, VideoProgress> = new Map();
  private totalVideos: number = 0;
  private completedVideos: number = 0;
  private logger: winston.Logger;
  private batchStartTime: number = 0;
  private totalInputTokens: number = 0;
  private totalOutputTokens: number = 0;
  private totalCost: number = 0;
  private batchResults: Array<{
    videoName: string;
    duration: number;
    model: string;
    frames: number;
    inputTokens: number;
    outputTokens: number;
    cost: number;
  }> = [];

  constructor(options: LoggerOptions = {}) {
    this.options = {
      enabled: options.enabled ?? false,
      showProgress: options.showProgress ?? true,
      showTimestamps: options.showTimestamps ?? false,
      level: options.level ?? 'normal',
      showEstimateTables: options.showEstimateTables ?? true,
    };

    // Create winston logger
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message }) => {
          const time = this.options.showTimestamps ? `[${new Date(timestamp as string).toLocaleTimeString()}] ` : '';
          return `${time}${message}`;
        })
      ),
      transports: [
        new winston.transports.Console({
          silent: !this.options.enabled
        })
      ]
    });
  }

  setOptions(options: Partial<LoggerOptions>): void {
    this.options = { ...this.options, ...options };
    this.logger.transports[0].silent = !this.options.enabled;
  }

  private formatDuration(ms: number): string {
    const seconds = ms / 1000;
    if (seconds < 60) return `${seconds.toFixed(2)}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = (seconds % 60).toFixed(0);
    return `${minutes}m ${remainingSeconds}s`;
  }

  private drawProgressBar(progress: number, width: number = 30): string {
    const clampedProgress = Math.max(0, Math.min(100, progress));
    const filled = Math.round((clampedProgress / 100) * width);
    const empty = Math.max(0, width - filled);
    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    return `[${bar}] ${clampedProgress.toFixed(0)}%`;
  }

  error(message: string, error?: Error | string): void {
    if (!this.options.enabled) return;
    const errorMsg = error instanceof Error ? error.message : error || '';
    this.logger.error(`[ERROR] ${message}${errorMsg ? ': ' + errorMsg : ''}`);
  }

  warn(message: string): void {
    if (!this.options.enabled) return;
    this.logger.warn(`[WARN] ${message}`);
  }

  initBatch(videoCount: number): void {
    if (!this.options.enabled) return;
    
    this.totalVideos = videoCount;
    this.completedVideos = 0;
    this.videoProgress.clear();
    this.batchStartTime = Date.now();
    this.totalInputTokens = 0;
    this.totalOutputTokens = 0;
    this.totalCost = 0;
    this.batchResults = [];

    // Only show init for normal and verbose
    if (this.options.level !== 'minimal') {
      console.log('');
      this.logger.info('═'.repeat(70));
      this.logger.info('[START] VIDEO ANALYSIS BATCH');
      this.logger.info('═'.repeat(70));
      
      const table = new Table({
        head: ['Total Videos', 'Status'],
        style: { head: [], border: [] }
      });
      table.push([videoCount, 'Initializing']);
      console.log(table.toString());
      console.log('');
    }
  }

  updateVideo(
    videoPath: string,
    status: VideoProgress['status'],
    stage: string,
    progress: number = 0,
    error?: string
  ): void {
    if (!this.options.enabled) return;

    const existing = this.videoProgress.get(videoPath);
    const videoName = videoPath.split(/[/\\]/).pop() || videoPath;

    const progressData: VideoProgress = {
      videoPath,
      status,
      progress,
      stage,
      startTime: existing?.startTime || Date.now(),
      endTime: status === 'completed' || status === 'failed' ? Date.now() : undefined,
      error,
    };

    this.videoProgress.set(videoPath, progressData);

    if (this.options.level === 'verbose') {
      const statusPrefix = {
        pending: '[PENDING]',
        processing: '[PROCESSING]',
        completed: '[COMPLETED]',
        failed: '[FAILED]',
      }[status];

      this.logger.info(`${statusPrefix} ${videoName}: ${stage}`);
    }
  }

  completeVideo(
    videoPath: string,
    frames: number,
    inputTokens: number,
    outputTokens: number,
    model: string
  ): void {
    if (!this.options.enabled) return;

    const progress = this.videoProgress.get(videoPath);
    if (!progress) return;

    this.completedVideos++;
    const duration = progress.startTime ? Date.now() - progress.startTime : 0;
    const videoName = videoPath.split(/[/\\]/).pop() || videoPath;
    const totalTokens = inputTokens + outputTokens;

    // Accumulate statistics
    this.totalInputTokens += inputTokens;
    this.totalOutputTokens += outputTokens;

    // Get pricing from models
    let inputPrice = 0.15;
    let outputPrice = 0.6;
    let cost = 0;
    
    try {
      const pricing = getModelPricing(model);
      inputPrice = pricing.inputCostPerMillion;
      outputPrice = pricing.outputCostPerMillion;
      cost = (inputTokens / 1000000) * inputPrice + (outputTokens / 1000000) * outputPrice;
    } catch {
      cost = (inputTokens / 1000000) * 0.15 + (outputTokens / 1000000) * 0.6;
    }

    this.totalCost += cost;

    // Store result for batch summary
    this.batchResults.push({
      videoName,
      duration,
      model,
      frames,
      inputTokens,
      outputTokens,
      cost
    });

    if (this.options.level === 'verbose') {
      this.logger.info(`[SUCCESS] ${videoName} completed (${this.completedVideos}/${this.totalVideos})`);
      this.logger.info(`  └─ Duration: ${this.formatDuration(duration)} | Frames: ${frames} | Tokens: ${totalTokens.toLocaleString()} | Cost: $${cost.toFixed(6)}`);
    }
    
    if (this.options.showProgress && this.options.level !== 'minimal') {
      const overallProgress = (this.completedVideos / this.totalVideos) * 100;
      console.log('');
      this.logger.info(`Overall Progress: ${this.drawProgressBar(overallProgress)}`);
      console.log('');
    }
  }

  failVideo(videoPath: string, error: string | Error): void {
    if (!this.options.enabled) return;

    const progress = this.videoProgress.get(videoPath);
    const duration = progress?.startTime ? Date.now() - progress.startTime : 0;
    const videoName = videoPath.split(/[/\\]/).pop() || videoPath;
    const errorMsg = error instanceof Error ? error.message : error;

    this.completedVideos++;

    // Only show detailed failure info for normal and verbose
    if (this.options.level !== 'minimal') {
      console.log('');
      this.logger.info('─'.repeat(70));
      this.logger.info(`[FAILED] VIDEO ${this.completedVideos}/${this.totalVideos} FAILED`);
      this.logger.info('─'.repeat(70));
      
      const table = new Table({
        head: ['File', 'Duration', 'Error'],
        style: { head: [], border: [] }
      });
      table.push([videoName, this.formatDuration(duration), errorMsg]);
      console.log(table.toString());
      
      if (this.options.showProgress) {
        const overallProgress = (this.completedVideos / this.totalVideos) * 100;
        this.logger.info(`Overall Progress: ${this.drawProgressBar(overallProgress)}`);
      }
      
      console.log('');
    }
  }

  completeBatch(totalDuration: number, successful: number, failed: number): void {
    if (!this.options.enabled) return;

    const actualDuration = Date.now() - this.batchStartTime;

    console.log('');
    this.logger.info('═'.repeat(70));
    this.logger.info('[END] BATCH ANALYSIS COMPLETE');
    this.logger.info('═'.repeat(70));
    
    const table = new Table({
      head: ['File', 'Duration', 'Model', 'Frames', 'Input Tokens', 'Output Tokens', 'Total Tokens', 'Cost'],
      style: { head: [], border: [] }
    });
    
    // Add each video result
    this.batchResults.forEach(result => {
      const totalTokens = result.inputTokens + result.outputTokens;
      table.push([
        result.videoName,
        this.formatDuration(result.duration),
        result.model,
        result.frames,
        result.inputTokens.toLocaleString(),
        result.outputTokens.toLocaleString(),
        totalTokens.toLocaleString(),
        `$${result.cost.toFixed(6)}`
      ]);
    });
    
    // Add totals row
    const grandTotalTokens = this.totalInputTokens + this.totalOutputTokens;
    table.push([
      `TOTAL (${successful} success, ${failed} failed)`,
      this.formatDuration(actualDuration),
      '-',
      '-',
      this.totalInputTokens.toLocaleString(),
      this.totalOutputTokens.toLocaleString(),
      grandTotalTokens.toLocaleString(),
      `$${this.totalCost.toFixed(6)}`
    ]);
    
    console.log(table.toString());
    this.logger.info('═'.repeat(70));
    console.log('');
    
    // Clear batch results for next batch
    this.batchResults = [];
  }

  startSingleVideo(videoPath: string): void {
    if (!this.options.enabled || this.options.level === 'minimal') return;
    
    const videoName = videoPath.split(/[/\\]/).pop() || videoPath;
    
    console.log('');
    this.logger.info('═'.repeat(70));
    this.logger.info('[START] VIDEO ANALYSIS');
    this.logger.info('═'.repeat(70));
    
    const table = new Table({
      head: ['File'],
      style: { head: [], border: [] }
    });
    table.push([videoName]);
    console.log(table.toString());
    console.log('');
  }

  logFrameExtraction(numFrames: number, quality: number, resolution: string): void {
    if (!this.options.enabled || this.options.level === 'minimal') return;
    this.logger.info(`[EXTRACTION] Extracting ${numFrames} frames (${resolution}, quality: ${quality})...`);
  }

  logAIAnalysis(numFrames: number, model: string): void {
    if (!this.options.enabled || this.options.level === 'minimal') return;  
    this.logger.info(`[ANALYSIS] Analyzing ${numFrames} frames with ${model}...`);
  }

  reset(): void {
    this.videoProgress.clear();
    this.totalVideos = 0;
    this.completedVideos = 0;
  }

  shouldShowEstimateTables(): boolean {
    return this.options.enabled && this.options.showEstimateTables;
  }
}

// Singleton instance
let loggerInstance: Logger | null = null;

/**
 * Gets or creates the logger instance
 */
export function getLogger(options?: LoggerOptions): Logger {
  if (!loggerInstance) {
    loggerInstance = new Logger(options);
  } else if (options) {
    loggerInstance.setOptions(options);
  }
  return loggerInstance;
}

/**
 * Configures global logger settings
 */
export function configureLogger(options: LoggerOptions): void {
  getLogger(options);
}

export default Logger;
