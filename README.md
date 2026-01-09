# Semantic Video

Intelligent video analysis using OpenAI vision models. Extract frames, generate descriptions, and search video content with natural language.


https://github.com/user-attachments/assets/c813edec-72f4-486e-b3c2-b4fa975ba844


## Overview

Semantic Video provides concurrent video processing with AI-powered frame analysis:
- Concurrent batch processing with configurable parallelism
- Frame extraction and analysis using OpenAI vision models
- Natural language descriptions of video content
- Simple keyword search across analyzed videos
- Token usage tracking and cost estimation

### Use Cases

- Content moderation and safety filtering
- Accessibility (automated alt-text and audio descriptions)
- Video search engines and content discovery
- Educational content analysis and indexing
- Security and surveillance monitoring
- Media asset management and tagging
- Sports and entertainment analytics
- Medical and scientific video analysis
- Quality assurance and compliance checking
- Automated video summarization and highlights

## Important Notes

- Token estimates may vary by ±10-20% from actual usage
- Not all models have been extensively tested - start with `gpt-5-nano` or `gpt-5-mini`
- Search uses simple keyword matching - descriptions provided as foundation for building advanced semantic search
- Logger at normal/verbose levels shows detailed breakdowns of estimates, token usage, and costs

## Installation

### Prerequisites

- Node.js 16+
- FFmpeg installed (macOS: `brew install ffmpeg`, Ubuntu: `sudo apt-get install ffmpeg`)
- OpenAI API key


```bash
npm install semantic-video
```


## Quick Start

```typescript
import SemanticVideoClient from 'semantic-video';

const client = new SemanticVideoClient(process.env.OPENAI_API_KEY);

const frames = await client.analyzeVideo('video.mp4');
const results = client.searchAllVideos('person');
```

## Usage Examples

### Basic Analysis

```typescript
import SemanticVideoClient from 'semantic-video';

const client = new SemanticVideoClient(apiKey);

// With defaults (10 frames, quality 10, 720p, gpt-5-nano)
const frames = await client.analyzeVideo('video.mp4');

// Custom parameters
await client.analyzeVideo(
  'video.mp4',
  20,                                     // frames
  'Describe the scene in detail',        // prompt
  10,                                     // quality (2-31)
  720,                                    // scale
  'gpt-5-nano'                           // model
);
```

### Token Estimation with Logger

Enable logger to see detailed breakdowns of estimates, usage, and costs. Processes multiple videos concurrently:

```typescript
const client = new SemanticVideoClient(apiKey, {
  enabled: true,
  level: 'normal'    // Shows progress, estimates table, and summaries
}, 3, 5);  // Process up to 3 videos concurrently, 5 frames per video

const estimate = await client.estimateMultipleVideosTokens([
  { videoPath: 'video1.mp4', numPartitions: 10 },
  { videoPath: 'video2.mp4', numPartitions: 15 }
]);

// Logger displays detailed estimate table automatically
// Access programmatically:
if (estimate.grandTotal.estimatedCost < 1.0) {
  await client.analyzeMultipleVideos([
    { videoPath: 'video1.mp4', numPartitions: 10 },
    { videoPath: 'video2.mp4', numPartitions: 15 }
  ]);
}
```

### Custom Prompts

```typescript
// Content moderation
await client.analyzeVideo(
  'upload.mp4',
  20,
  'Identify inappropriate, violent, or harmful content'
);

// Accessibility
await client.analyzeVideo(
  'tutorial.mp4',
  50,
  'Describe all visual elements, text, and interactions for audio description',
  5  // Higher quality for detail
);
```

### Preventing Rate Limits

```typescript
// Estimate before processing to avoid rate limits
const estimate = await client.estimateVideoTokens('large-video.mp4', 50);

// Check against your rate limit (e.g., 200k tokens/min for tier 1)
const RATE_LIMIT = 200000;
if (estimate.total.totalTokens > RATE_LIMIT) {
  // Adjust parameters to stay under limit
  const reducedFrames = Math.floor(RATE_LIMIT / estimate.perFrame.totalTokens);
  console.log(`Reducing from 50 to ${reducedFrames} frames to avoid rate limit`);
  await client.analyzeVideo('large-video.mp4', reducedFrames);
} else {
  await client.analyzeVideo('large-video.mp4', 50);
}
```

### Search

```typescript
await client.analyzeVideo('video.mp4');
const results = client.searchAllVideos('person');
// Returns: [{ videoPath, frames: FrameData[] }]
```

### Direct Class Usage

```typescript
import { SemanticVideo } from 'semantic-video';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const video = new SemanticVideo('video.mp4', apiKey, openai);

await video.analyze(15, 'Describe the scene', 10, 720, 'gpt-5-nano');
const frame5 = video.getFrame(5);
const matches = video.searchFrames('person');
const tokens = video.getTokensUsed();  // { inputTokens, outputTokens, totalTokens, model }
video.saveFrame(5, 'frame-5.jpg');
await video.cleanup();
```

## Supported Models

Pricing: input/output per 1M tokens

### GPT-5 Family
- `gpt-5-nano` (default): $0.05/$0.40
- `gpt-5-mini`: $0.25/$2.00
- `gpt-5`: $1.25/$10.00
- `gpt-5.1`: $1.25/$10.00
- `gpt-5.2`: $1.75/$14.00
- `gpt-5-pro`: $15.00/$120.00
- `gpt-5.2-pro`: $21.00/$168.00

### GPT-4.1 Family
- `gpt-4.1-nano`: $0.10/$0.40
- `gpt-4.1-mini`: $0.40/$1.60
- `gpt-4.1`: $2.00/$8.00

### O-Series
- `o4-mini`: $1.10/$4.40
- `o3`: $2.00/$8.00
- `o3-pro`: $20.00/$80.00
- `o1`: $15.00/$60.00

## Configuration

### Concurrency Control

Control processing speed and API throughput with two levels of concurrency:

```typescript
const client = new SemanticVideoClient(
  apiKey,
  loggerOptions,
  3,  // maxConcurrency: Process 3 videos simultaneously
  5   // maxFrameConcurrency: Analyze 5 frames per video concurrently
);
```

- **Video-level concurrency** (`maxConcurrency`): Number of videos processed simultaneously (default: 3)
- **Frame-level concurrency** (`maxFrameConcurrency`): Number of frames analyzed concurrently per video (default: 5)
- Higher values = faster processing but higher API rate usage
- Adjust based on your OpenAI API rate limits and tier

### Quality vs Cost

Quality parameter affects token usage and file size:

| Quality | Tokens/Frame | Use Case |
|---------|--------------|----------|
| 2-5 | ~500-800 | Critical detail |
| 10 (default) | ~300-400 | Balanced |
| 15-20 | ~150-250 | Cost-effective |
| 25-31 | ~100-150 | Maximum savings |

### Scale (Resolution)

- `-1`: Original (may be large, uses more tokens)
- `1080`: High detail, more tokens
- `720` (default): Balanced
- `480`: Fewer tokens, faster

### Reducing Token Usage

- Reduce `numPartitions` (fewer frames)
- Increase `quality` value (15-20)
- Decrease `scale` (480)
- Use `gpt-5-nano`

## Troubleshooting

**FFmpeg not found:** Install FFmpeg (`brew install ffmpeg` on macOS, `sudo apt-get install ffmpeg` on Ubuntu)

**High token usage:** Use token estimation before analysis, adjust quality/scale/partitions

**Memory issues:** Reduce `maxConcurrency`, process in smaller batches, call `await video.cleanup()`

## Contributing

[Open an issue on GitHub](https://github.com/LMSAIH/semantic-video/issues)

## Links

- [GitHub Repository](https://github.com/LMSAIH/semantic-video)
- [OpenAI Vision API](https://platform.openai.com/docs/guides/vision)
- [FFmpeg Documentation](https://ffmpeg.org/documentation.html)

## License


ISC
