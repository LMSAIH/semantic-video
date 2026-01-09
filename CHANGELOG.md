# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.8] - 2026-01-02

### Added
- Frame-level concurrency control with `maxFrameConcurrency` parameter (default: 5)
- Per-video unique temporary directories to prevent file conflicts during concurrent processing

### Changed
- Improved video concurrency from fixed batches to dynamic queue system
- Videos now start processing immediately when a slot opens, rather than waiting for batch completion
- Frame analysis now uses dynamic concurrency control for better throughput
- `VideoAnalysisResult` interface now returns `inputTokensUsed`, `outputTokensUsed`, `modelUsed`, `videoDuration`, `frames`, and `videoPath`

### Fixed
- Fixed race condition in concurrent video processing
- Fixed file collision issues when multiple videos process simultaneously
- Fixed promise tracking in concurrency control using Set instead of Array

## [1.0.7] - 2026-01-02

### Fixed
- Fixed ESM imports by adding `.js` extensions to all relative imports
- Changed `moduleResolution` to `node16` for proper Node.js ESM support
- Package now works correctly when installed from npm

### Changed
- Deprecated versions < 1.0.7 due to broken ESM imports

## [1.0.6] - 2026-01-02

### Known Issues
- Broken ESM imports - do not use this version

## [1.0.0 - 1.0.5]

Initial releases with core functionality:
- Video frame extraction and analysis
- OpenAI Vision API integration
- Token estimation and cost tracking
- Multi-video concurrent processing
- Search functionality
- Comprehensive logging system
