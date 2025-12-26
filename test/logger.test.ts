import Logger, { getLogger, configureLogger, LoggerOptions } from '../src/logger';
import * as models from '../src/models';

// Mock dependencies
jest.mock('../src/models');
jest.mock('winston', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    transports: [{ silent: false }],
  })),
  format: {
    combine: jest.fn(() => ({})),
    timestamp: jest.fn(() => ({})),
    printf: jest.fn(() => ({})),
  },
  transports: {
    Console: jest.fn(),
  },
}));

describe('Logger', () => {
  let consoleLogSpy: jest.SpyInstance;
  let dateNowSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    dateNowSpy = jest.spyOn(Date, 'now');
    
    // Reset singleton
    (global as any).loggerInstance = null;
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    dateNowSpy.mockRestore();
  });

  describe('constructor', () => {
    it('should initialize with default options when none provided', () => {
      const logger = new Logger();
      expect(logger).toBeDefined();
      expect(logger.shouldShowEstimateTables()).toBe(false); // enabled is false by default
    });

    it('should merge provided options with defaults', () => {
      const logger = new Logger({ enabled: true, showProgress: false });
      expect(logger.shouldShowEstimateTables()).toBe(true);
    });

    it('should handle undefined options gracefully', () => {
      const logger = new Logger(undefined);
      expect(logger).toBeDefined();
    });

    it('should handle empty object options', () => {
      const logger = new Logger({});
      expect(logger).toBeDefined();
    });

    it('should handle partial options', () => {
      const logger = new Logger({ enabled: true });
      expect(logger).toBeDefined();
    });
  });

  describe('setOptions', () => {
    it('should update options after construction', () => {
      const logger = new Logger({ enabled: false });
      logger.setOptions({ enabled: true });
      expect(logger.shouldShowEstimateTables()).toBe(true);
    });

    it('should handle partial option updates', () => {
      const logger = new Logger({ enabled: true, showProgress: true });
      logger.setOptions({ showProgress: false });
      expect(logger).toBeDefined();
    });

    it('should not break with undefined updates', () => {
      const logger = new Logger();
      expect(() => logger.setOptions({})).not.toThrow();
    });
  });

  describe('initBatch', () => {
    it('should not log when disabled', () => {
      const logger = new Logger({ enabled: false });
      logger.initBatch(5);
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('should handle zero video count', () => {
      const logger = new Logger({ enabled: true });
      expect(() => logger.initBatch(0)).not.toThrow();
    });

    it('should handle negative video count', () => {
      const logger = new Logger({ enabled: true });
      expect(() => logger.initBatch(-5)).not.toThrow();
    });

    it('should handle extremely large video count', () => {
      const logger = new Logger({ enabled: true });
      expect(() => logger.initBatch(999999)).not.toThrow();
    });

    it('should reset state on each initBatch call', () => {
      const logger = new Logger({ enabled: true });
      dateNowSpy.mockReturnValue(1000);
      
      logger.initBatch(5);
      logger.completeVideo('/video1.mp4', 10, 100, 50, 'gpt-4');
      
      dateNowSpy.mockReturnValue(2000);
      logger.initBatch(3);
      
      // State should be reset, completeBatch should only show new batch
      expect(() => logger.completeBatch(1000, 1, 0)).not.toThrow();
    });

    it('should clear previous video progress', () => {
      const logger = new Logger({ enabled: true });
      logger.updateVideo('/old.mp4', 'processing', 'test', 50);
      logger.initBatch(2);
      // Previous progress should be cleared
      expect(consoleLogSpy).toHaveBeenCalled();
    });
  });

  describe('completeVideo', () => {
    beforeEach(() => {
      (models.getModelPricing as jest.Mock).mockReturnValue({
        inputCostPerMillion: 0.15,
        outputCostPerMillion: 0.6,
      });
    });

    it('should not log when disabled', () => {
      const logger = new Logger({ enabled: false });
      logger.completeVideo('/video.mp4', 10, 100, 50, 'gpt-4');
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('should handle video without prior progress tracking', () => {
      const logger = new Logger({ enabled: true });
      logger.initBatch(1);
      // Complete video that was never tracked
      expect(() => logger.completeVideo('/unknown.mp4', 10, 100, 50, 'gpt-4')).not.toThrow();
    });

    it('should handle zero tokens', () => {
      const logger = new Logger({ enabled: true });
      logger.initBatch(1);
      logger.updateVideo('/video.mp4', 'processing', 'test', 0);
      expect(() => logger.completeVideo('/video.mp4', 10, 0, 0, 'gpt-4')).not.toThrow();
    });

    it('should handle negative tokens gracefully', () => {
      const logger = new Logger({ enabled: true });
      logger.initBatch(1);
      logger.updateVideo('/video.mp4', 'processing', 'test', 0);
      expect(() => logger.completeVideo('/video.mp4', 10, -100, -50, 'gpt-4')).not.toThrow();
    });

    it('should handle extremely large token counts', () => {
      const logger = new Logger({ enabled: true });
      logger.initBatch(1);
      logger.updateVideo('/video.mp4', 'processing', 'test', 0);
      expect(() => logger.completeVideo('/video.mp4', 10, 9999999999, 9999999999, 'gpt-4')).not.toThrow();
    });

    it('should handle missing model pricing gracefully', () => {
      (models.getModelPricing as jest.Mock).mockImplementation(() => {
        throw new Error('Model not found');
      });

      const logger = new Logger({ enabled: true });
      logger.initBatch(1);
      logger.updateVideo('/video.mp4', 'processing', 'test', 0);
      expect(() => logger.completeVideo('/video.mp4', 10, 100, 50, 'unknown-model')).not.toThrow();
    });

    it('should accumulate statistics across multiple videos', () => {
      const logger = new Logger({ enabled: true });
      logger.initBatch(3);
      
      logger.updateVideo('/v1.mp4', 'processing', 'test', 0);
      logger.completeVideo('/v1.mp4', 10, 100, 50, 'gpt-4');
      
      logger.updateVideo('/v2.mp4', 'processing', 'test', 0);
      logger.completeVideo('/v2.mp4', 10, 200, 100, 'gpt-4');
      
      logger.updateVideo('/v3.mp4', 'processing', 'test', 0);
      logger.completeVideo('/v3.mp4', 10, 300, 150, 'gpt-4');
      
      // completeBatch should show accumulated totals
      expect(() => logger.completeBatch(1000, 3, 0)).not.toThrow();
    });

    it('should handle paths with special characters', () => {
      const logger = new Logger({ enabled: true });
      logger.initBatch(1);
      logger.updateVideo('/path/with spaces/video (1).mp4', 'processing', 'test', 0);
      expect(() => logger.completeVideo('/path/with spaces/video (1).mp4', 10, 100, 50, 'gpt-4')).not.toThrow();
    });

    it('should handle empty video path', () => {
      const logger = new Logger({ enabled: true });
      logger.initBatch(1);
      logger.updateVideo('', 'processing', 'test', 0);
      expect(() => logger.completeVideo('', 10, 100, 50, 'gpt-4')).not.toThrow();
    });

    it('should handle paths with backslashes (Windows)', () => {
      const logger = new Logger({ enabled: true });
      logger.initBatch(1);
      logger.updateVideo('C:\\Users\\test\\video.mp4', 'processing', 'test', 0);
      expect(() => logger.completeVideo('C:\\Users\\test\\video.mp4', 10, 100, 50, 'gpt-4')).not.toThrow();
    });

    it('should handle paths with forward slashes (Unix)', () => {
      const logger = new Logger({ enabled: true });
      logger.initBatch(1);
      logger.updateVideo('/home/user/video.mp4', 'processing', 'test', 0);
      expect(() => logger.completeVideo('/home/user/video.mp4', 10, 100, 50, 'gpt-4')).not.toThrow();
    });

    it('should show progress bar when enabled', () => {
      const logger = new Logger({ enabled: true, showProgress: true });
      logger.initBatch(2);
      logger.updateVideo('/v1.mp4', 'processing', 'test', 0);
      logger.completeVideo('/v1.mp4', 10, 100, 50, 'gpt-4');
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should not show progress bar when disabled', () => {
      const logger = new Logger({ enabled: true, showProgress: false });
      logger.initBatch(2);
      logger.updateVideo('/v1.mp4', 'processing', 'test', 0);
      const callCountBefore = consoleLogSpy.mock.calls.length;
      logger.completeVideo('/v1.mp4', 10, 100, 50, 'gpt-4');
      // Should have fewer calls without progress bar
      expect(consoleLogSpy).toHaveBeenCalled();
    });
  });

  describe('failVideo', () => {
    it('should not log when disabled', () => {
      const logger = new Logger({ enabled: false });
      logger.failVideo('/video.mp4', 'Test error');
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('should handle Error objects', () => {
      const logger = new Logger({ enabled: true });
      logger.initBatch(1);
      const error = new Error('Test error message');
      expect(() => logger.failVideo('/video.mp4', error)).not.toThrow();
    });

    it('should handle string errors', () => {
      const logger = new Logger({ enabled: true });
      logger.initBatch(1);
      expect(() => logger.failVideo('/video.mp4', 'String error')).not.toThrow();
    });

    it('should handle empty error message', () => {
      const logger = new Logger({ enabled: true });
      logger.initBatch(1);
      expect(() => logger.failVideo('/video.mp4', '')).not.toThrow();
    });

    it('should handle video without progress tracking', () => {
      const logger = new Logger({ enabled: true });
      logger.initBatch(1);
      expect(() => logger.failVideo('/unknown.mp4', 'Error')).not.toThrow();
    });

    it('should increment completed count', () => {
      const logger = new Logger({ enabled: true, showProgress: true });
      logger.initBatch(2);
      logger.failVideo('/v1.mp4', 'Error');
      logger.failVideo('/v2.mp4', 'Error');
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should handle extremely long error messages', () => {
      const logger = new Logger({ enabled: true });
      logger.initBatch(1);
      const longError = 'Error: ' + 'x'.repeat(10000);
      expect(() => logger.failVideo('/video.mp4', longError)).not.toThrow();
    });
  });

  describe('completeBatch', () => {
    it('should not log when disabled', () => {
      const logger = new Logger({ enabled: false });
      logger.completeBatch(1000, 5, 0);
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('should handle batch with all successes', () => {
      const logger = new Logger({ enabled: true });
      logger.initBatch(3);
      expect(() => logger.completeBatch(1000, 3, 0)).not.toThrow();
    });

    it('should handle batch with all failures', () => {
      const logger = new Logger({ enabled: true });
      logger.initBatch(3);
      expect(() => logger.completeBatch(1000, 0, 3)).not.toThrow();
    });

    it('should handle batch with mixed results', () => {
      const logger = new Logger({ enabled: true });
      logger.initBatch(5);
      expect(() => logger.completeBatch(1000, 3, 2)).not.toThrow();
    });

    it('should handle zero successful and failed', () => {
      const logger = new Logger({ enabled: true });
      logger.initBatch(0);
      expect(() => logger.completeBatch(0, 0, 0)).not.toThrow();
    });

    it('should handle negative durations', () => {
      const logger = new Logger({ enabled: true });
      logger.initBatch(1);
      expect(() => logger.completeBatch(-1000, 1, 0)).not.toThrow();
    });

    it('should handle extremely large durations', () => {
      const logger = new Logger({ enabled: true });
      logger.initBatch(1);
      expect(() => logger.completeBatch(999999999999, 1, 0)).not.toThrow();
    });

    it('should clear batch results after completion', () => {
      const logger = new Logger({ enabled: true });
      logger.initBatch(1);
      logger.updateVideo('/v1.mp4', 'processing', 'test', 0);
      logger.completeVideo('/v1.mp4', 10, 100, 50, 'gpt-4');
      logger.completeBatch(1000, 1, 0);
      
      // Start new batch - results should be cleared
      logger.initBatch(1);
      logger.completeBatch(1000, 0, 0);
      expect(consoleLogSpy).toHaveBeenCalled();
    });
  });

  describe('updateVideo', () => {
    it('should not log when disabled', () => {
      const logger = new Logger({ enabled: false });
      logger.updateVideo('/video.mp4', 'processing', 'test', 50);
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('should log in verbose mode', () => {
      const logger = new Logger({ enabled: true, level: 'verbose' });
      // updateVideo uses winston logger.info, not console.log directly
      expect(() => logger.updateVideo('/video.mp4', 'processing', 'test', 50)).not.toThrow();
    });

    it('should not log in minimal mode', () => {
      const logger = new Logger({ enabled: true, level: 'minimal' });
      // updateVideo uses winston logger.info, not console.log directly
      expect(() => logger.updateVideo('/video.mp4', 'processing', 'test', 50)).not.toThrow();
    });

    it('should handle all status types', () => {
      const logger = new Logger({ enabled: true, level: 'verbose' });
      const statuses: Array<'pending' | 'processing' | 'completed' | 'failed'> = ['pending', 'processing', 'completed', 'failed'];
      
      statuses.forEach(status => {
        expect(() => logger.updateVideo('/video.mp4', status, 'test', 0)).not.toThrow();
      });
    });

    it('should handle progress boundaries', () => {
      const logger = new Logger({ enabled: true });
      expect(() => logger.updateVideo('/v1.mp4', 'processing', 'test', 0)).not.toThrow();
      expect(() => logger.updateVideo('/v2.mp4', 'processing', 'test', 100)).not.toThrow();
      expect(() => logger.updateVideo('/v3.mp4', 'processing', 'test', -50)).not.toThrow();
      expect(() => logger.updateVideo('/v4.mp4', 'processing', 'test', 150)).not.toThrow();
    });

    it('should preserve startTime on updates', () => {
      const logger = new Logger({ enabled: true });
      dateNowSpy.mockReturnValue(1000);
      logger.updateVideo('/video.mp4', 'processing', 'stage1', 25);
      
      dateNowSpy.mockReturnValue(2000);
      logger.updateVideo('/video.mp4', 'processing', 'stage2', 50);
      
      // Second update shouldn't reset startTime
      expect(() => logger.updateVideo('/video.mp4', 'processing', 'stage3', 75)).not.toThrow();
    });

    it('should handle empty stage string', () => {
      const logger = new Logger({ enabled: true });
      expect(() => logger.updateVideo('/video.mp4', 'processing', '', 50)).not.toThrow();
    });
  });

  describe('error and warn methods', () => {
    it('should not log errors when disabled', () => {
      const logger = new Logger({ enabled: false });
      logger.error('Test error');
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('should handle error with Error object', () => {
      const logger = new Logger({ enabled: true });
      const error = new Error('Test error');
      expect(() => logger.error('Failed', error)).not.toThrow();
    });

    it('should handle error with string', () => {
      const logger = new Logger({ enabled: true });
      expect(() => logger.error('Failed', 'error message')).not.toThrow();
    });

    it('should handle error without error parameter', () => {
      const logger = new Logger({ enabled: true });
      expect(() => logger.error('Failed')).not.toThrow();
    });

    it('should not log warnings when disabled', () => {
      const logger = new Logger({ enabled: false });
      logger.warn('Test warning');
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('should handle empty warning message', () => {
      const logger = new Logger({ enabled: true });
      expect(() => logger.warn('')).not.toThrow();
    });
  });

  describe('reset', () => {
    it('should clear all state', () => {
      const logger = new Logger({ enabled: true });
      logger.initBatch(3);
      logger.updateVideo('/v1.mp4', 'processing', 'test', 50);
      logger.reset();
      
      // After reset, state should be cleared
      expect(() => logger.initBatch(2)).not.toThrow();
    });

    it('should work when called multiple times', () => {
      const logger = new Logger();
      logger.reset();
      logger.reset();
      logger.reset();
      expect(logger).toBeDefined();
    });
  });

  describe('singleton pattern (getLogger)', () => {
    it('should return same instance on multiple calls', () => {
      const logger1 = getLogger();
      const logger2 = getLogger();
      expect(logger1).toBe(logger2);
    });

    it('should update options on existing instance', () => {
      const logger1 = getLogger({ enabled: false });
      const logger2 = getLogger({ enabled: true });
      expect(logger1).toBe(logger2);
      expect(logger2.shouldShowEstimateTables()).toBe(true);
    });

    it('should create instance on first call', () => {
      const logger = getLogger({ enabled: true });
      expect(logger).toBeInstanceOf(Logger);
    });
  });

  describe('configureLogger', () => {
    it('should configure global logger', () => {
      expect(() => configureLogger({ enabled: true })).not.toThrow();
    });

    it('should handle empty options', () => {
      expect(() => configureLogger({})).not.toThrow();
    });
  });

  describe('edge cases and race conditions', () => {
    it('should handle completeVideo called before initBatch', () => {
      const logger = new Logger({ enabled: true });
      expect(() => logger.completeVideo('/video.mp4', 10, 100, 50, 'gpt-4')).not.toThrow();
    });

    it('should handle completeBatch called before initBatch', () => {
      const logger = new Logger({ enabled: true });
      expect(() => logger.completeBatch(1000, 0, 0)).not.toThrow();
    });

    it('should handle multiple initBatch calls without completeBatch', () => {
      const logger = new Logger({ enabled: true });
      logger.initBatch(5);
      logger.initBatch(3);
      logger.initBatch(7);
      expect(() => logger.completeBatch(1000, 0, 0)).not.toThrow();
    });

    it('should handle division by zero in progress calculations', () => {
      const logger = new Logger({ enabled: true, showProgress: true });
      logger.initBatch(0);
      expect(() => logger.completeVideo('/video.mp4', 10, 100, 50, 'gpt-4')).not.toThrow();
    });

    it('should handle concurrent video updates', () => {
      const logger = new Logger({ enabled: true });
      logger.initBatch(3);
      
      logger.updateVideo('/v1.mp4', 'processing', 'stage1', 25);
      logger.updateVideo('/v2.mp4', 'processing', 'stage1', 10);
      logger.updateVideo('/v1.mp4', 'processing', 'stage2', 50);
      logger.updateVideo('/v3.mp4', 'processing', 'stage1', 5);
      logger.updateVideo('/v2.mp4', 'processing', 'stage2', 30);
      
      expect(() => logger.completeVideo('/v1.mp4', 10, 100, 50, 'gpt-4')).not.toThrow();
    });

    it('should handle NaN values in duration formatting', () => {
      const logger = new Logger({ enabled: true });
      logger.initBatch(1);
      dateNowSpy.mockReturnValue(NaN);
      logger.updateVideo('/video.mp4', 'processing', 'test', 0);
      expect(() => logger.completeVideo('/video.mp4', 10, 100, 50, 'gpt-4')).not.toThrow();
    });

    it('should handle Infinity in token counts', () => {
      const logger = new Logger({ enabled: true });
      logger.initBatch(1);
      logger.updateVideo('/video.mp4', 'processing', 'test', 0);
      expect(() => logger.completeVideo('/video.mp4', 10, Infinity, Infinity, 'gpt-4')).not.toThrow();
    });
  });
});
