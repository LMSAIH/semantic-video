// Frame analysis
export { analyzeFrame, analyzeFrames } from './src/frame-analyzers.js';

// Token estimation
export { estimateFrameTokens, estimateFramesTokens, countTextTokens, countImageTokens, type TokenEstimate } from './src/token-estimate.js';

// Models configuration
export { 
  VISION_MODELS, 
  getModelConfig, 
  getModelPricing, 
  getImageTokenMultiplier, 
  calculateCost,
  getSupportedModels,
  type VisionModelConfig, 
  type ModelPricing 
} from './src/models.js';

// Core classes
export { default as SemanticVideo, type FrameData } from './src/semantic-video.js';
export { default as SemanticVideoClient, type VideoAnalysisResult, type LoggerOptions } from './src/client.js';
export { default } from './src/client.js';

// Constants
export { DEFAULT_MODEL, DEFAULT_PROMPT, DEFAULT_SCALE } from './src/constants.js';

// Logger
export { getLogger, configureLogger, default as Logger } from "./src/logger.js";

// Utility modules (for advanced usage)
export { default as VideoRegistry } from './src/video-registry.js';
export { default as StatsTracker, type ClientStats } from './src/stats-tracker.js';
export { default as TokenEstimator, type VideoTokenEstimate, type MultiVideoTokenEstimate } from './src/token-estimator.js';
export { default as VideoSearch, type SearchResult } from './src/video-search.js';