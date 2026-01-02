# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
