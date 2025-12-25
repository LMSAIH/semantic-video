// Frame analysis
export { analyzeFrame, analyzeFrames } from './src/frame-analyzers';

// Token estimation
export { estimateFrameTokens, estimateFramesTokens, countTextTokens, countImageTokens, type TokenEstimate } from './src/token-estimate';

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
} from './src/models';

// Core classes
export { default as SemanticVideo, type FrameData } from './src/semantic-video';
export { default as SemanticVideoClient, type VideoAnalysisResult, type LoggerOptions } from './src/client';
export { default } from './src/client';

// Logger
export { getLogger, configureLogger, default as Logger } from "./src/logger";

// Utility modules (for advanced usage)
export { default as VideoRegistry } from './src/video-registry';
export { default as StatsTracker, type ClientStats } from './src/stats-tracker';
export { default as TokenEstimator, type VideoTokenEstimate, type MultiVideoTokenEstimate } from './src/token-estimator';
export { default as VideoSearch, type SearchResult } from './src/video-search';