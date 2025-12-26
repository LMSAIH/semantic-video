import VideoSearch from '../src/video-search';
import SemanticVideo, { FrameData } from '../src/semantic-video';

jest.mock('../src/semantic-video');

describe('VideoSearch', () => {
  let videoSearch: VideoSearch;
  let mockVideo1: jest.Mocked<Partial<SemanticVideo>>;
  let mockVideo2: jest.Mocked<Partial<SemanticVideo>>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockVideo1 = {
      searchFrames: jest.fn(),
    };
    mockVideo2 = {
      searchFrames: jest.fn(),
    };
    videoSearch = new VideoSearch();
  });

  describe('searchAll', () => {
    it('should search across all videos and return matching frames', () => {
      const mockFrames1: FrameData[] = [
        { frameNumber: 1, timestamp: 0, description: 'test frame 1', imageData: 'base64data1' },
      ];
      const mockFrames2: FrameData[] = [
        { frameNumber: 5, timestamp: 2.5, description: 'test frame 2', imageData: 'base64data2' },
      ];

      (mockVideo1.searchFrames as jest.Mock).mockReturnValue(mockFrames1);
      (mockVideo2.searchFrames as jest.Mock).mockReturnValue(mockFrames2);

      const videoIterator = (callback: (video: SemanticVideo, path: string) => void) => {
        callback(mockVideo1 as SemanticVideo, '/path/to/video1.mp4');
        callback(mockVideo2 as SemanticVideo, '/path/to/video2.mp4');
      };

      const results = videoSearch.searchAll('test keyword', videoIterator);

      expect(mockVideo1.searchFrames).toHaveBeenCalledWith('test keyword');
      expect(mockVideo2.searchFrames).toHaveBeenCalledWith('test keyword');
      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({
        videoPath: '/path/to/video1.mp4',
        frames: mockFrames1,
      });
      expect(results[1]).toEqual({
        videoPath: '/path/to/video2.mp4',
        frames: mockFrames2,
      });
    });

    it('should only return videos with matching frames', () => {
      const mockFrames: FrameData[] = [
        { frameNumber: 1, timestamp: 0, description: 'test frame', imageData: 'base64data' },
      ];

      (mockVideo1.searchFrames as jest.Mock).mockReturnValue(mockFrames);
      (mockVideo2.searchFrames as jest.Mock).mockReturnValue([]);

      const videoIterator = (callback: (video: SemanticVideo, path: string) => void) => {
        callback(mockVideo1 as SemanticVideo, '/path/to/video1.mp4');
        callback(mockVideo2 as SemanticVideo, '/path/to/video2.mp4');
      };

      const results = videoSearch.searchAll('test keyword', videoIterator);

      expect(results).toHaveLength(1);
      expect(results[0].videoPath).toBe('/path/to/video1.mp4');
    });

    it('should return empty array when no videos have matches', () => {
      (mockVideo1.searchFrames as jest.Mock).mockReturnValue([]);
      (mockVideo2.searchFrames as jest.Mock).mockReturnValue([]);

      const videoIterator = (callback: (video: SemanticVideo, path: string) => void) => {
        callback(mockVideo1 as SemanticVideo, '/path/to/video1.mp4');
        callback(mockVideo2 as SemanticVideo, '/path/to/video2.mp4');
      };

      const results = videoSearch.searchAll('test keyword', videoIterator);

      expect(results).toEqual([]);
    });

    it('should work with no videos', () => {
      const videoIterator = (callback: (video: SemanticVideo, path: string) => void) => {
        // No videos to iterate
      };

      const results = videoSearch.searchAll('test keyword', videoIterator);

      expect(results).toEqual([]);
    });
  });

  describe('searchVideo', () => {
    it('should search a single video and return matching frames', () => {
      const mockFrames: FrameData[] = [
        { frameNumber: 1, timestamp: 0, description: 'test frame 1', imageData: 'base64data1' },
        { frameNumber: 3, timestamp: 1.5, description: 'test frame 2', imageData: 'base64data2' },
      ];

      (mockVideo1.searchFrames as jest.Mock).mockReturnValue(mockFrames);

      const results = videoSearch.searchVideo('test keyword', mockVideo1 as SemanticVideo);

      expect(mockVideo1.searchFrames).toHaveBeenCalledWith('test keyword');
      expect(results).toEqual(mockFrames);
    });

    it('should return empty array when no frames match', () => {
      (mockVideo1.searchFrames as jest.Mock).mockReturnValue([]);

      const results = videoSearch.searchVideo('test keyword', mockVideo1 as SemanticVideo);

      expect(results).toEqual([]);
    });

    it('should pass keyword correctly to searchFrames', () => {
      (mockVideo1.searchFrames as jest.Mock).mockReturnValue([]);

      videoSearch.searchVideo('specific keyword', mockVideo1 as SemanticVideo);

      expect(mockVideo1.searchFrames).toHaveBeenCalledWith('specific keyword');
    });
  });
});