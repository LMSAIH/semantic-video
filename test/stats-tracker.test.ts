import StatsTracker from '../src/stats-tracker';
import SemanticVideo from '../src/semantic-video';
import { calculateCost } from '../src/models';
import { DEFAULT_MODEL } from '../src/constants';

jest.mock('../src/semantic-video');
jest.mock('../src/models');

describe('StatsTracker', () => {
  let statsTracker: StatsTracker;

  beforeEach(() => {
    statsTracker = new StatsTracker();
    jest.clearAllMocks();
    (calculateCost as jest.Mock).mockReturnValue(0.001);
  });

  describe('constructor', () => {
    it('should initialize with zero values', () => {
      expect(statsTracker.tokens).toBe(0);
      expect(statsTracker.cost).toBe(0);
      expect(statsTracker.apiCalls).toBe(0);
    });
  });

  describe('recordAnalysis', () => {
    it('should record basic analysis with default model', () => {
      statsTracker.recordAnalysis(100, 50, 1);
      
      expect(statsTracker.tokens).toBe(150);
      expect(statsTracker.apiCalls).toBe(1);
      expect(calculateCost).toHaveBeenCalledWith(100, 50, DEFAULT_MODEL);
    });

    it('should record analysis with custom model', () => {
      statsTracker.recordAnalysis(200, 100, 2, 'gpt-4o-mini');
      
      expect(statsTracker.tokens).toBe(300);
      expect(statsTracker.apiCalls).toBe(2);
      expect(calculateCost).toHaveBeenCalledWith(200, 100, 'gpt-4o-mini');
    });

    it('should accumulate multiple analyses', () => {
      (calculateCost as jest.Mock).mockReturnValue(0.01);
      
      statsTracker.recordAnalysis(100, 50, 1);
      statsTracker.recordAnalysis(200, 100, 2);
      statsTracker.recordAnalysis(150, 75, 1);
      
      expect(statsTracker.tokens).toBe(675);
      expect(statsTracker.apiCalls).toBe(4);
      expect(statsTracker.cost).toBe(0.03);
    });

    it('should handle zero tokens', () => {
      statsTracker.recordAnalysis(0, 0, 0);
      
      expect(statsTracker.tokens).toBe(0);
      expect(statsTracker.apiCalls).toBe(0);
    });

    it('should handle large token counts', () => {
      statsTracker.recordAnalysis(1000000, 500000, 100);
      
      expect(statsTracker.tokens).toBe(1500000);
      expect(statsTracker.apiCalls).toBe(100);
    });
  });

  describe('getStats', () => {
    it('should return stats with no videos', () => {
      const videoIterator = (callback: (video: SemanticVideo) => void) => {
        // No videos
      };

      const stats = statsTracker.getStats(videoIterator);

      expect(stats.totalVideos).toBe(0);
      expect(stats.totalFrames).toBe(0);
      expect(stats.totalDuration).toBe(0);
      expect(stats.averageFramesPerVideo).toBe(0);
      expect(stats.averageTokensPerVideo).toBe(0);
      expect(stats.averageTokensPerFrame).toBe(0);
    });

    it('should calculate stats for single video', () => {
      const mockVideo = {
        getFramesCount: jest.fn().mockReturnValue(5),
        getDuration: jest.fn().mockReturnValue(10),
      } as unknown as SemanticVideo;

      statsTracker.recordAnalysis(500, 250, 5);

      const videoIterator = (callback: (video: SemanticVideo) => void) => {
        callback(mockVideo);
      };

      const stats = statsTracker.getStats(videoIterator);

      expect(stats.totalVideos).toBe(1);
      expect(stats.totalFrames).toBe(5);
      expect(stats.totalDuration).toBe(10);
      expect(stats.totalTokensUsed).toBe(750);
      expect(stats.averageFramesPerVideo).toBe(5);
      expect(stats.averageTokensPerVideo).toBe(750);
      expect(stats.averageTokensPerFrame).toBe(150);
    });

    it('should calculate stats for multiple videos', () => {
      const mockVideo1 = {
        getFramesCount: jest.fn().mockReturnValue(5),
        getDuration: jest.fn().mockReturnValue(10),
      } as unknown as SemanticVideo;

      const mockVideo2 = {
        getFramesCount: jest.fn().mockReturnValue(3),
        getDuration: jest.fn().mockReturnValue(6),
      } as unknown as SemanticVideo;

      const mockVideo3 = {
        getFramesCount: jest.fn().mockReturnValue(7),
        getDuration: jest.fn().mockReturnValue(14),
      } as unknown as SemanticVideo;

      statsTracker.recordAnalysis(500, 250, 5);
      statsTracker.recordAnalysis(300, 150, 3);
      statsTracker.recordAnalysis(700, 350, 7);

      const videoIterator = (callback: (video: SemanticVideo) => void) => {
        callback(mockVideo1);
        callback(mockVideo2);
        callback(mockVideo3);
      };

      const stats = statsTracker.getStats(videoIterator);

      expect(stats.totalVideos).toBe(3);
      expect(stats.totalFrames).toBe(15);
      expect(stats.totalDuration).toBe(30);
      expect(stats.totalTokensUsed).toBe(2250);
      expect(stats.totalApiCalls).toBe(15);
      expect(stats.averageFramesPerVideo).toBe(5);
      expect(stats.averageTokensPerVideo).toBe(750);
      expect(stats.averageTokensPerFrame).toBe(150);
    });

    it('should handle videos with zero frames', () => {
      const mockVideo = {
        getFramesCount: jest.fn().mockReturnValue(0),
        getDuration: jest.fn().mockReturnValue(0),
      } as unknown as SemanticVideo;

      const videoIterator = (callback: (video: SemanticVideo) => void) => {
        callback(mockVideo);
      };

      const stats = statsTracker.getStats(videoIterator);

      expect(stats.averageTokensPerFrame).toBe(0);
    });
  });

  describe('getters', () => {
    it('should return correct tokens value', () => {
      statsTracker.recordAnalysis(100, 50, 1);
      expect(statsTracker.tokens).toBe(150);
    });

    it('should return correct cost value', () => {
      (calculateCost as jest.Mock).mockReturnValue(0.05);
      statsTracker.recordAnalysis(100, 50, 1);
      expect(statsTracker.cost).toBe(0.05);
    });

    it('should return correct apiCalls value', () => {
      statsTracker.recordAnalysis(100, 50, 3);
      expect(statsTracker.apiCalls).toBe(3);
    });
  });

  describe('reset', () => {
    it('should reset all values to zero', () => {
      statsTracker.recordAnalysis(500, 250, 5);
      expect(statsTracker.tokens).toBe(750);
      expect(statsTracker.apiCalls).toBe(5);
      
      statsTracker.reset();
      
      expect(statsTracker.tokens).toBe(0);
      expect(statsTracker.cost).toBe(0);
      expect(statsTracker.apiCalls).toBe(0);
    });

    it('should allow recording after reset', () => {
      statsTracker.recordAnalysis(100, 50, 1);
      statsTracker.reset();
      statsTracker.recordAnalysis(200, 100, 2);
      
      expect(statsTracker.tokens).toBe(300);
      expect(statsTracker.apiCalls).toBe(2);
    });

    it('should be safe to call multiple times', () => {
      statsTracker.reset();
      statsTracker.reset();
      statsTracker.reset();
      
      expect(statsTracker.tokens).toBe(0);
      expect(statsTracker.cost).toBe(0);
      expect(statsTracker.apiCalls).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should handle NaN in calculations', () => {
      statsTracker.recordAnalysis(NaN, NaN, 1);
      expect(isNaN(statsTracker.tokens)).toBe(true);
    });

    it('should handle negative values', () => {
      statsTracker.recordAnalysis(-100, -50, -1);
      expect(statsTracker.tokens).toBe(-150);
      expect(statsTracker.apiCalls).toBe(-1);
    });

    it('should handle very large numbers', () => {
      statsTracker.recordAnalysis(1e15, 1e15, 1000);
      expect(statsTracker.tokens).toBe(2e15);
      expect(statsTracker.apiCalls).toBe(1000);
    });
  });
});
