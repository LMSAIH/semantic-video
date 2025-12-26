import VideoRegistry from '../src/video-registry';
import SemanticVideo from '../src/semantic-video';
import OpenAI from 'openai';

jest.mock('../src/semantic-video');
jest.mock('openai');

describe('VideoRegistry', () => {
  let videoRegistry: VideoRegistry;
  let mockOpenAIClient: jest.Mocked<OpenAI>;
  const testApiKey = 'test-api-key';

  beforeEach(() => {
    jest.clearAllMocks();
    mockOpenAIClient = new OpenAI({ apiKey: testApiKey }) as jest.Mocked<OpenAI>;
    videoRegistry = new VideoRegistry(testApiKey, mockOpenAIClient);
  });

  describe('create', () => {
    it('should create and register a new SemanticVideo instance', () => {
      const videoPath = '/path/to/video.mp4';
      
      const video = videoRegistry.create(videoPath);

      expect(SemanticVideo).toHaveBeenCalledWith(videoPath, testApiKey, mockOpenAIClient);
      expect(video).toBeInstanceOf(SemanticVideo);
      expect(videoRegistry.get(videoPath)).toBe(video);
    });

    it('should create multiple different videos', () => {
      const videoPath1 = '/path/to/video1.mp4';
      const videoPath2 = '/path/to/video2.mp4';

      const video1 = videoRegistry.create(videoPath1);
      const video2 = videoRegistry.create(videoPath2);

      expect(video1).not.toBe(video2);
      expect(videoRegistry.count).toBe(2);
    });

    it('should replace existing video with same path', () => {
      const videoPath = '/path/to/video.mp4';

      const video1 = videoRegistry.create(videoPath);
      const video2 = videoRegistry.create(videoPath);

      expect(videoRegistry.count).toBe(1);
      expect(videoRegistry.get(videoPath)).toBe(video2);
    });
  });

  describe('get', () => {
    it('should return video instance by path', () => {
      const videoPath = '/path/to/video.mp4';
      const video = videoRegistry.create(videoPath);

      const retrieved = videoRegistry.get(videoPath);

      expect(retrieved).toBe(video);
    });

    it('should return undefined for non-existent video', () => {
      const retrieved = videoRegistry.get('/non/existent/video.mp4');

      expect(retrieved).toBeUndefined();
    });
  });

  describe('getOrCreate', () => {
    it('should return existing video if present', () => {
      const videoPath = '/path/to/video.mp4';
      const video = videoRegistry.create(videoPath);

      const retrieved = videoRegistry.getOrCreate(videoPath);

      expect(retrieved).toBe(video);
      expect(videoRegistry.count).toBe(1);
    });

    it('should create new video if not present', () => {
      const videoPath = '/path/to/video.mp4';

      const video = videoRegistry.getOrCreate(videoPath);

      expect(video).toBeInstanceOf(SemanticVideo);
      expect(videoRegistry.get(videoPath)).toBe(video);
    });
  });

  describe('getAll', () => {
    it('should return empty map initially', () => {
      const allVideos = videoRegistry.getAll();

      expect(allVideos.size).toBe(0);
    });

    it('should return all registered videos', () => {
      const videoPath1 = '/path/to/video1.mp4';
      const videoPath2 = '/path/to/video2.mp4';
      const video1 = videoRegistry.create(videoPath1);
      const video2 = videoRegistry.create(videoPath2);

      const allVideos = videoRegistry.getAll();

      expect(allVideos.size).toBe(2);
      expect(allVideos.get(videoPath1)).toBe(video1);
      expect(allVideos.get(videoPath2)).toBe(video2);
    });
  });

  describe('remove', () => {
    it('should remove video from registry and return true', () => {
      const videoPath = '/path/to/video.mp4';
      videoRegistry.create(videoPath);

      const removed = videoRegistry.remove(videoPath);

      expect(removed).toBe(true);
      expect(videoRegistry.get(videoPath)).toBeUndefined();
      expect(videoRegistry.count).toBe(0);
    });

    it('should return false for non-existent video', () => {
      const removed = videoRegistry.remove('/non/existent/video.mp4');

      expect(removed).toBe(false);
    });

    it('should only remove specified video', () => {
      const videoPath1 = '/path/to/video1.mp4';
      const videoPath2 = '/path/to/video2.mp4';
      videoRegistry.create(videoPath1);
      const video2 = videoRegistry.create(videoPath2);

      videoRegistry.remove(videoPath1);

      expect(videoRegistry.count).toBe(1);
      expect(videoRegistry.get(videoPath2)).toBe(video2);
    });
  });

  describe('clear', () => {
    it('should remove all videos from registry', () => {
      videoRegistry.create('/path/to/video1.mp4');
      videoRegistry.create('/path/to/video2.mp4');
      videoRegistry.create('/path/to/video3.mp4');

      videoRegistry.clear();

      expect(videoRegistry.count).toBe(0);
      expect(videoRegistry.getAll().size).toBe(0);
    });

    it('should work when registry is already empty', () => {
      videoRegistry.clear();

      expect(videoRegistry.count).toBe(0);
    });
  });

  describe('count', () => {
    it('should return 0 initially', () => {
      expect(videoRegistry.count).toBe(0);
    });

    it('should return correct count after adding videos', () => {
      videoRegistry.create('/path/to/video1.mp4');
      expect(videoRegistry.count).toBe(1);

      videoRegistry.create('/path/to/video2.mp4');
      expect(videoRegistry.count).toBe(2);
    });

    it('should return correct count after removing videos', () => {
      videoRegistry.create('/path/to/video1.mp4');
      videoRegistry.create('/path/to/video2.mp4');
      videoRegistry.remove('/path/to/video1.mp4');

      expect(videoRegistry.count).toBe(1);
    });
  });

  describe('forEach', () => {
    it('should iterate over all videos', () => {
      const videoPath1 = '/path/to/video1.mp4';
      const videoPath2 = '/path/to/video2.mp4';
      const video1 = videoRegistry.create(videoPath1);
      const video2 = videoRegistry.create(videoPath2);

      const callback = jest.fn();
      videoRegistry.forEach(callback);

      expect(callback).toHaveBeenCalledTimes(2);
      expect(callback.mock.calls[0][0]).toBe(video1);
      expect(callback.mock.calls[0][1]).toBe(videoPath1);
      expect(callback.mock.calls[1][0]).toBe(video2);
      expect(callback.mock.calls[1][1]).toBe(videoPath2);
    });

    it('should not call callback for empty registry', () => {
      const callback = jest.fn();
      videoRegistry.forEach(callback);

      expect(callback).not.toHaveBeenCalled();
    });

    it('should pass correct video and path to callback', () => {
      const videoPath = '/path/to/video.mp4';
      const video = videoRegistry.create(videoPath);

      videoRegistry.forEach((v, p) => {
        expect(v).toBe(video);
        expect(p).toBe(videoPath);
      });
    });
  });
});