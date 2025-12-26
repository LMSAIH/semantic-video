import SemanticVideo from '../src/semantic-video';
import fs from 'fs';
import OpenAI from 'openai';
import * as logger from '../src/logger';

// Mock dependencies
jest.mock('../src/frame-analyzers');
jest.mock('fluent-ffmpeg');
jest.mock('fs');
jest.mock('../src/logger');
jest.mock('openai');

describe('SemanticVideo', () => {
  const mockVideoPath = '/path/to/video.mp4';
  const mockApiKey = 'test-api-key';
  const mockClient = {} as OpenAI;
  
  let mockLogger: any;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    
    // Mock fs.existsSync to return true by default
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    
    // Mock logger
    mockLogger = {
      logFrameExtraction: jest.fn(),
      logAIAnalysis: jest.fn(),
    };
    (logger.getLogger as jest.Mock).mockReturnValue(mockLogger);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('constructor', () => {
    it('should throw error when video file does not exist', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      expect(() => new SemanticVideo(mockVideoPath, mockApiKey, mockClient)).toThrow('Video file not found');
    });

    it('should throw error when client not provided', () => {
      expect(() => new SemanticVideo(mockVideoPath, mockApiKey, null as any)).toThrow('OpenAI client is required');
    });

    it('should create instance with valid API key and client', () => {
      const video = new SemanticVideo(mockVideoPath, mockApiKey, mockClient);
      expect(video).toBeInstanceOf(SemanticVideo);
    });
  });



  describe('getTokensUsed', () => {
    it('should return zeros before analysis', () => {
      const video = new SemanticVideo(mockVideoPath, mockApiKey, mockClient);
      const tokens = video.getTokensUsed();
      
      expect(tokens.inputTokens).toBe(0);
      expect(tokens.outputTokens).toBe(0);
      expect(tokens.totalTokens).toBe(0);
    });
  });

  describe('getFrames and getFrame', () => {
    it('should return empty array and undefined before analysis', () => {
      const video = new SemanticVideo(mockVideoPath, mockApiKey, mockClient);
      expect(video.getFrames()).toEqual([]);
      expect(video.getFrame(1)).toBeUndefined();
    });
  });

  describe('searchFrames', () => {
    it('should return empty array when no frames exist', () => {
      const video = new SemanticVideo(mockVideoPath, mockApiKey, mockClient);
      expect(video.searchFrames('test')).toEqual([]);
    });
  });

  describe('saveFrame', () => {
    it('should throw error for non-existent frame', () => {
      const video = new SemanticVideo(mockVideoPath, mockApiKey, mockClient);
      expect(() => video.saveFrame(1, '/output.jpg')).toThrow('Frame 1 not found');
    });
  });

  describe('cleanup', () => {
    it('should not throw when cleanup is called', () => {
      const video = new SemanticVideo(mockVideoPath, mockApiKey, mockClient);
      expect(video.cleanup()).resolves.not.toThrow();
    });
  });
});
