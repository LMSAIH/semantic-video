# Semantic Video

A powerful TypeScript/Node.js library for intelligent video analysis using AI vision models. Extract, analyze, and search through video frames with natural language descriptions powered by OpenAI's vision capabilities.

## Important Notes

- **Token Estimation**: Token estimates are approximate and may vary by ±10-20% from actual usage due to model-specific tokenization differences
- **Model Testing**: Not all supported models have been extensively tested with video analysis. We recommend starting with `gpt-5-nano` or `gpt-5-mini` for production use
- **Bug Reports**: If you encounter any issues, please [open an issue on GitHub](https://github.com/LMSAIH/semantic-video/issues) with details about the model, video format, and error message

## What is Semantic Video?

Semantic Video transforms videos into searchable, analyzable content by:
- **Extracting key frames** from videos at specified intervals
- **Generating semantic descriptions** using AI vision models 
- **Enabling natural language search** across video content
- **Tracking token usage and costs** for budget management
- **Supporting batch processing** for multiple videos

Perfect for building video search engines, content moderation systems, accessibility tools, educational platforms, and more.

## Prerequisites

Before using Semantic Video, ensure you have:

- **Node.js** 16+ installed
- **FFmpeg** installed on your system:
  - macOS: `brew install ffmpeg`
  - Ubuntu/Debian: `sudo apt-get install ffmpeg`
  - Windows: Download from [ffmpeg.org](https://ffmpeg.org/download.html)
- **OpenAI API key** with access to vision models

## Installation

```bash
npm install semantic-video
```

## Quick Start

```typescript
import SemanticVideoClient from 'semantic-video';

const client = new SemanticVideoClient(process.env.OPENAI_API_KEY);

// Analyze a single video (using defaults)
const frames = await client.analyzeVideo('path/to/video.mp4');

// Access frame descriptions
frames.forEach(frame => {
  console.log(`Frame ${frame.frameNumber} at ${frame.timestamp}s: ${frame.description}`);
});

// Search through analyzed videos
const results = client.searchAllVideos('person');
console.log(`Found ${results.length} matching frames`);
```

## Key Concepts

### Prompt Flexibility
The `prompt` parameter is **highly flexible** and can be customized for your specific use case:
- **Default**: Generates comma-separated semantic keywords optimized for search
- **Custom**: Use detailed prompts like "Describe the scene with focus on facial expressions and emotions"
- **Specialized**: Tailor prompts for specific domains (medical, sports, security, etc.)

### Image Quality
All frames are analyzed using **OpenAI's high detail mode** for maximum accuracy, regardless of quality/resolution settings.

### Search Capabilities
The built-in search uses **simple keyword matching** against the descriptions:
- **Good for**: Quick keyword-based searches when using default prompt
- **Limitations**: No semantic understanding (searching "happy" won't find "joyful")
- **Recommended**: Use descriptions as a base to build advanced search with:
  - Semantic search models (e.g., sentence transformers)
  - Vector databases (e.g., Pinecone, Weaviate)
  - Full-text search engines (e.g., Elasticsearch)

The frame descriptions are designed to provide a solid foundation for building sophisticated search systems tailored to your needs.

## Default Values

Understanding the defaults helps you get started quickly:

| Parameter | Default Value | Description |
|-----------|--------------|-------------|
| `numPartitions` | `10` | Number of frames to extract from video |
| `quality` | `10` | JPEG quality (2-31, lower = better quality) |
| `scale` | `720` | Output frame height in pixels |
| `model` | `'gpt-5-nano'` | AI model to use for analysis |
| `prompt` | Auto-optimized | Semantic keyword extraction prompt |
| `maxConcurrency` | `3` | Max videos processed simultaneously |
| `logLevel` | `'normal'` | Logging verbosity (`'minimal'` \| `'normal'` \| `'verbose'`) |

## Use Case Examples

All examples below have been tested and verified to work. The default prompt generates comma-separated keywords optimized for simple keyword search.

### 1. **Basic Video Analysis**

```typescript
import SemanticVideoClient from 'semantic-video';

const client = new SemanticVideoClient(apiKey);

// Analyze with defaults (10 frames, quality 10, 720p, gpt-5-nano)
const frames = await client.analyzeVideo('video.mp4');

// Or customize everything
const customFrames = await client.analyzeVideo(
  'video.mp4',
  3,                    // Extract 3 frames
  'Describe what you see in this frame',  // Custom prompt
  15,                   // JPEG quality 15
  720,                  // 720p
  'gpt-5-nano'         // Model
);

console.log(`Analyzed ${customFrames.length} frames`);
console.log(`First frame: ${customFrames[0].description}`);
```

### 2. **Video Search with Keywords**

```typescript
const client = new SemanticVideoClient(apiKey);

// Analyze a video (default prompt creates keyword descriptions)
await client.analyzeVideo('samples/video1.mp4', 10);

// Search using simple keywords
const results = client.searchAllVideos('person');

results.forEach(result => {
  console.log(`${result.videoPath} at ${result.frame.timestamp.toFixed(1)}s`);
  console.log(`  ${result.frame.description}`);
});
```

**Note**: Search uses simple keyword matching. For better results, consider implementing semantic search with the generated descriptions.

### 3. **Custom Prompts for Specific Use Cases**

```typescript
const client = new SemanticVideoClient(apiKey);

// Content moderation with specific instructions
const moderationFrames = await client.analyzeVideo(
  'user-upload.mp4',
  20, //Number of frames to extract
  'Identify any inappropriate, violent, or harmful content. Be specific.'
);

// Accessibility - detailed descriptions
const a11yFrames = await client.analyzeVideo(
  'tutorial.mp4',
  50, 
  'Describe all visual elements, actions, text on screen, and UI interactions for audio description',
  5  // High quality for accuracy
);

// Technical analysis
const techFrames = await client.analyzeVideo(
  'product-demo.mp4',
  15,
  'List all UI elements, buttons, text, and technical details visible'
);
```

### 4. **Batch Processing with Token Estimation**

```typescript
const client = new SemanticVideoClient(apiKey, {
  enabled: true,
  showProgress: true,
  level: 'normal'
});

// Estimate costs FIRST
const estimate = await client.estimateMultipleVideosTokens([
  { videoPath: 'video1.mp4', numPartitions: 10, quality: 15 },
  { videoPath: 'video2.mp4', numPartitions: 10, quality: 15 }
]);

console.log(`Estimated cost: $${estimate.grandTotal.estimatedCost.toFixed(4)}`);
console.log(`Total tokens: ${estimate.grandTotal.totalTokens}`);

// Proceed if acceptable
if (estimate.grandTotal.estimatedCost < 1.0) {
  const results = await client.analyzeMultipleVideos([
    { videoPath: 'video1.mp4', numPartitions: 10, quality: 15 },
    { videoPath: 'video2.mp4', numPartitions: 10, quality: 15 }
  ]);
  
  const stats = client.getStats();
  console.log(`Actual cost: $${stats.totalCost.toFixed(4)}`);
}
```

### 5. **Quality vs Cost Trade-offs**

```typescript
const client = new SemanticVideoClient(apiKey);

// High quality (more expensive) - 5-10x more tokens
const highQuality = await client.analyzeVideo(
  'important-video.mp4',
  20,
  undefined,  // Use default prompt
  5,          // High quality (low number = better)
  1080,       // 1080p
  'gpt-5-mini'
);

// Low quality (cheaper) - Suitable for drafts/testing
const lowQuality = await client.analyzeVideo(
  'draft-video.mp4',
  10,
  undefined,
  20,         // Lower quality (high number = worse)
  480,        // 480p
  'gpt-5-nano'
);
```

### 6. **Advanced: Direct SemanticVideo Class**

```typescript
import { SemanticVideo } from 'semantic-video';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const video = new SemanticVideo('video.mp4', apiKey, openai);

// Analyze
const frames = await video.analyze(15, 'Describe the scene', 10, 720, 'gpt-5-nano');

// Access individual frames
const frame5 = video.getFrame(5);
console.log(`Frame 5: ${frame5?.description}`);

// Search within this specific video
const matches = video.searchFrames('person', 3);

// Get token usage
const tokens = video.getTokensUsed();
console.log(`Used ${tokens.totalTokens} tokens`);

// Save a frame as JPEG
video.saveFrame(5, 'output/frame-5.jpg');

// Cleanup temporary files
await video.cleanup();
```

### 7. **Statistics and Cost Tracking**

```typescript
const client = new SemanticVideoClient(apiKey);

// Analyze multiple videos
await client.analyzeVideo('video1.mp4', 10, undefined, 20);
await client.analyzeVideo('video2.mp4', 15, undefined, 20);

// Get comprehensive statistics
const stats = client.getStats();
console.log(`Videos analyzed: ${stats.videosAnalyzed}`);
console.log(`Total frames: ${stats.totalFrames}`);
console.log(`Input tokens: ${stats.totalInputTokens}`);
console.log(`Output tokens: ${stats.totalOutputTokens}`);
console.log(`Total cost: $${stats.totalCost.toFixed(4)}`);
console.log(`Model usage:`, stats.modelUsage);
```

## Complete API Reference

### SemanticVideoClient

#### Constructor
```typescript
new SemanticVideoClient(
  apiKey: string,
  loggerOptions?: {
    enabled?: boolean;          // Default: false
    showProgress?: boolean;     // Default: true
    showTimestamps?: boolean;   // Default: false
    level?: 'minimal' | 'normal' | 'verbose';  // Default: 'normal'
    showEstimateTables?: boolean;  // Default: true
  },
  maxConcurrency?: number       // Default: 3
)
```

#### analyzeVideo()
```typescript
async analyzeVideo(
  videoPath: string,
  numPartitions?: number,    // Default: 10
  prompt?: string,           // Default: optimized semantic prompt
  quality?: number,          // Default: 10 (range: 2-31)
  scale?: number,            // Default: 720 (use -1 for original)
  model?: string             // Default: 'gpt-5-nano'
): Promise<FrameData[]>
```

**Returns:** Array of frames with:
- `frameNumber`: Frame index (1-based)
- `timestamp`: Time in video (seconds)
- `description`: AI-generated description
- `imageData`: Base64 encoded JPEG

**Example:**
```typescript
const frames = await client.analyzeVideo(
  'video.mp4',
  20,              // Extract 20 frames
  'Describe the main action and setting',
  15,              // Quality 15 (balanced)
  720,             // 720p
  'gpt-5-mini'     // Use mini model
);
```

#### analyzeMultipleVideos()
```typescript
async analyzeMultipleVideos(
  configs: Array<{
    videoPath: string;
    numPartitions?: number;
    prompt?: string;
    quality?: number;
    scale?: number;
    model?: string;
  }>
): Promise<VideoAnalysisResult[]>
```

**Returns:** Array of results with `videoPath`, `video`, `frames`, and optional `error`

**Example:**
```typescript
const results = await client.analyzeMultipleVideos([
  { 
    videoPath: 'video1.mp4', 
    numPartitions: 15, 
    quality: 10,
    model: 'gpt-5-nano'
  },
  { 
    videoPath: 'video2.mp4', 
    numPartitions: 20,
    quality: 15,
    scale: 1080
  }
]);
```

#### estimateVideoTokens()
```typescript
async estimateVideoTokens(
  videoPath: string,
  numPartitions: number,
  prompt?: string,           // Default: optimized prompt
  model?: string,            // Default: 'gpt-5-nano'
  quality?: number,          // Default: 10
  scale?: number             // Default: 720
): Promise<VideoTokenEstimate>
```

**Returns:**
- `videoPath`: Path to the video
- `numPartitions`: Number of frames
- `perFrame`: Token estimate per frame (object with `textTokens`, `imageTokens`, `totalTokens`, `estimatedCost`)
- `total`: Total token estimate (object with `textTokens`, `imageTokens`, `totalTokens`, `estimatedCost`)
- `model`: Model used

**Example:**
```typescript
const estimate = await client.estimateVideoTokens(
  'large-video.mp4',
  50,
  undefined,
  'gpt-5-mini',
  10,
  720
);

console.log(`Estimated cost: $${estimate.total.estimatedCost.toFixed(4)}`);
console.log(`Total tokens: ${estimate.total.totalTokens}`);
console.log(`Per frame: ${estimate.perFrame.totalTokens} tokens`);
```

#### searchAllVideos()
```typescript
searchAllVideos(keyword: string, topK?: number): SearchResult[]
```

**Returns:** Array of matches sorted by relevance with:
- `videoPath`: Path to video
- `frame`: Matching FrameData object
- `score`: Relevance score (0-1)

**Example:**
```typescript
const results = client.searchAllVideos('sunset beach', 10);
results.forEach(r => {
  console.log(`${r.videoPath} (${r.score.toFixed(2)}): ${r.frame.description}`);
});
```

#### getStats()
```typescript
getStats(): ClientStats
```

**Returns:**
- `videosAnalyzed`: Total videos processed
- `totalFrames`: Total frames analyzed
- `totalInputTokens`: Total input tokens used
- `totalOutputTokens`: Total output tokens used
- `totalCost`: Total cost in USD
- `modelUsage`: Per-model breakdown

## Supported Models

All models support vision inputs. Pricing and performance vary:

### GPT-5 Family (Recommended)
- **`gpt-5-nano`** ⭐ (Default) - $0.05/$0.40 per 1M tokens - Fastest, most cost-efficient
- **`gpt-5-mini`** - $0.25/$2.00 per 1M tokens - Balanced speed and quality
- **`gpt-5`** - $1.25/$10.00 per 1M tokens - Intelligent reasoning
- **`gpt-5.1`** - $1.25/$10.00 per 1M tokens - Improved reasoning
- **`gpt-5.2`** - $1.75/$14.00 per 1M tokens - Best for complex tasks
- **`gpt-5-pro`** - $15.00/$120.00 per 1M tokens - Maximum precision
- **`gpt-5.2-pro`** - $21.00/$168.00 per 1M tokens - Enhanced precision

### GPT-4.1 Family
- **`gpt-4.1-nano`** - $0.10/$0.40 per 1M tokens - Smallest, fastest
- **`gpt-4.1-mini`** - $0.40/$1.60 per 1M tokens - Balanced
- **`gpt-4.1`** - $2.00/$8.00 per 1M tokens - Smartest non-reasoning

### O-Series (Reasoning Models)
- **`o4-mini`** - $1.10/$4.40 per 1M tokens - Fast reasoning
- **`o3`** - $2.00/$8.00 per 1M tokens - Complex reasoning
- **`o3-pro`** - $20.00/$80.00 per 1M tokens - Maximum compute
- **`o1`** - $15.00/$60.00 per 1M tokens - Previous reasoning model

**Note:** Pricing is input/output cost per 1 million tokens. Vision tasks use more input tokens than text-only tasks.

## Configuration Guide

### Logger Levels

```typescript
// Minimal: Only final summary table
const client1 = new SemanticVideoClient(apiKey, {
  enabled: true,
  level: 'minimal'
});

// Normal: Progress bars, batch info, summary
const client2 = new SemanticVideoClient(apiKey, {
  enabled: true,
  level: 'normal',
  showProgress: true
});

// Verbose: Detailed per-video stats, extraction info, timings
const client3 = new SemanticVideoClient(apiKey, {
  enabled: true,
  level: 'verbose',
  showProgress: true,
  showTimestamps: true
});
```

### Quality vs Cost Trade-offs

The `quality` parameter directly affects token usage and image file size:

| Quality | Token Usage | Use Case | File Size |
|---------|-------------|----------|-----------|
| 2-5 | ~500-800/frame | Critical detail needed | ~50-100KB |
| 10 | ~300-400/frame | Balanced (default) | ~20-40KB |
| 15-20 | ~150-250/frame | Cost-effective | ~10-20KB |
| 25-31 | ~100-150/frame | Maximum savings | ~5-10KB |

### Resolution Settings

```typescript
// Original resolution (may be very large, uses more tokens)
await client.analyzeVideo('video.mp4', 10, undefined, 10, -1);

// 1080p (high detail, more tokens)
await client.analyzeVideo('video.mp4', 10, undefined, 10, 1080);

// 720p (default, balanced)
await client.analyzeVideo('video.mp4', 10, undefined, 10, 720);

// 480p (faster, fewer tokens)
await client.analyzeVideo('video.mp4', 10, undefined, 10, 480);
```

## Troubleshooting

### FFmpeg Not Found
```bash
# Verify installation
ffmpeg -version

# macOS
brew install ffmpeg

# Ubuntu/Debian
sudo apt-get update && sudo apt-get install ffmpeg

# Windows
# Download from https://ffmpeg.org/download.html and add to PATH
```

### OpenAI Rate Limits
```typescript
// Use token estimation to stay within limits
const estimate = await client.estimateVideoTokens('video.mp4', 50);

if (estimate.total.estimatedCost > 5.0) {
  console.log('Cost too high, reducing frames or quality');
  // Adjust parameters accordingly
}
```

### High Token Usage
- Reduce `numPartitions` (fewer frames)
- Increase `quality` value (15-20 for lower cost)
- Decrease `scale` (480 instead of 720)
- Use `gpt-5-nano` instead of larger, more expensive models

### Memory Issues
- Reduce `maxConcurrency` parameter
- Process videos in smaller batches
- Clean up videos after processing: `await video.cleanup()`

### Inaccurate Token Estimates
Token estimates may vary ±10-20% from actual usage due to:
- Model-specific tokenization differences
- Prompt length variations
- Image complexity affecting compression

## Bug Reports

If you encounter issues:

1. **Check prerequisites**: Node.js 16+, FFmpeg installed, valid API key
2. **Verify the model** is supported (see list above)
3. **Try with a small test video** first (< 30 seconds)
4. **Report the issue** with:
   - Model used
   - Video format and duration
   - Full error message
   - Code snippet that reproduces the issue

[Open an issue on GitHub →](https://github.com/LMSAIH/semantic-video/issues)

## License

ISC

## Contributing

Contributions welcome! Please open an issue or submit a pull request.

## Links

- [OpenAI Vision API Documentation](https://platform.openai.com/docs/guides/vision)
- [FFmpeg Documentation](https://ffmpeg.org/documentation.html)
- [GitHub Repository](https://github.com/LMSAIH/semantic-video)

---

Made with ❤️ for developers building intelligent video applications