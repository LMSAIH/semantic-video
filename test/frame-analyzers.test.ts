import { analyzeFrame, analyzeFrames } from '../src/frame-analyzers';
import OpenAI from 'openai';
import fs from 'fs';

jest.mock('openai');
jest.mock('fs');

describe('Frame Analyzers', () => {
  const mockApiKey = 'test-api-key';
  const mockImagePath = '/path/to/image.jpg';
  const mockImagePaths = ['/path/to/image1.jpg', '/path/to/image2.jpg'];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('analyzeFrame', () => {
    it('should throw error when neither API key nor client provided', async () => {
      await expect(
        analyzeFrame(mockImagePath, '', 'test prompt', null as any)
      ).rejects.toThrow('API key or client is required');
    });

    it('should read image file and convert to base64', async () => {
      const mockBuffer = Buffer.from('fake-image-data');
      (fs.readFileSync as jest.Mock).mockReturnValue(mockBuffer);

      const mockClient = {
        chat: {
          completions: {
            create: jest.fn().mockResolvedValue({
              choices: [{ message: { content: 'Frame description' } }],
              usage: { prompt_tokens: 100, completion_tokens: 50 },
            }),
          },
        },
      };

      const result = await analyzeFrame(
        mockImagePath,
        mockApiKey,
        'Describe this',
        mockClient as any
      );

      expect(fs.readFileSync).toHaveBeenCalledWith(mockImagePath);
      expect(result.content).toBe('Frame description');
      expect(result.inputTokens).toBe(100);
      expect(result.outputTokens).toBe(50);
    });

    it('should handle different image formats', async () => {
      const mockBuffer = Buffer.from('fake-image-data');
      (fs.readFileSync as jest.Mock).mockReturnValue(mockBuffer);

      const mockClient = {
        chat: {
          completions: {
            create: jest.fn().mockResolvedValue({
              choices: [{ message: { content: 'PNG description' } }],
              usage: { prompt_tokens: 100, completion_tokens: 50 },
            }),
          },
        },
      };

      await analyzeFrame('/path/to/image.png', mockApiKey, 'test', mockClient as any);

      const createCall = (mockClient.chat.completions.create as jest.Mock).mock.calls[0][0];
      const imageUrl = createCall.messages[0].content[1].image_url.url;
      expect(imageUrl).toContain('data:image/png;base64,');
    });

    it('should use default JPEG mime type for unknown extensions', async () => {
      const mockBuffer = Buffer.from('fake-image-data');
      (fs.readFileSync as jest.Mock).mockReturnValue(mockBuffer);

      const mockClient = {
        chat: {
          completions: {
            create: jest.fn().mockResolvedValue({
              choices: [{ message: { content: 'Description' } }],
              usage: { prompt_tokens: 100, completion_tokens: 50 },
            }),
          },
        },
      };

      await analyzeFrame('/path/to/image.unknown', mockApiKey, 'test', mockClient as any);

      const createCall = (mockClient.chat.completions.create as jest.Mock).mock.calls[0][0];
      const imageUrl = createCall.messages[0].content[1].image_url.url;
      expect(imageUrl).toContain('data:image/jpeg;base64,');
    });

    it('should handle missing token usage in response', async () => {
      const mockBuffer = Buffer.from('fake-image-data');
      (fs.readFileSync as jest.Mock).mockReturnValue(mockBuffer);

      const mockClient = {
        chat: {
          completions: {
            create: jest.fn().mockResolvedValue({
              choices: [{ message: { content: 'Description' } }],
              usage: undefined,
            }),
          },
        },
      };

      const result = await analyzeFrame(mockImagePath, mockApiKey, 'test', mockClient as any);

      expect(result.inputTokens).toBe(0);
      expect(result.outputTokens).toBe(0);
    });
  });

  describe('analyzeFrames', () => {
    it('should throw error when neither API key nor client provided', async () => {
      await expect(
        analyzeFrames(mockImagePaths, '', 'test prompt')
      ).rejects.toThrow('API key or client is required');
    });

    it('should analyze multiple frames and return descriptions', async () => {
      const mockBuffer = Buffer.from('fake-image-data');
      (fs.readFileSync as jest.Mock).mockReturnValue(mockBuffer);
      (fs.existsSync as jest.Mock).mockReturnValue(true);

      const mockClient = {
        chat: {
          completions: {
            create: jest.fn()
              .mockResolvedValueOnce({
                choices: [{ message: { content: 'Frame 1 description' } }],
                usage: { prompt_tokens: 100, completion_tokens: 50 },
              })
              .mockResolvedValueOnce({
                choices: [{ message: { content: 'Frame 2 description' } }],
                usage: { prompt_tokens: 120, completion_tokens: 60 },
              }),
          },
        },
      };

      const result = await analyzeFrames(
        mockImagePaths,
        mockApiKey,
        'Describe this',
        mockClient as any
      );

      expect(result.descriptions).toEqual(['Frame 1 description', 'Frame 2 description']);
      expect(result.totalInputTokens).toBe(220);
      expect(result.totalOutputTokens).toBe(110);
    });

    it('should throw error when image file does not exist', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      const mockClient = {
        chat: {
          completions: {
            create: jest.fn(),
          },
        },
      };

      await expect(
        analyzeFrames(['/nonexistent/image.jpg'], mockApiKey, 'test', mockClient as any)
      ).rejects.toThrow('Frame 1 failed: File not found');
    });

    it('should handle partial failures in batch analysis', async () => {
      (fs.existsSync as jest.Mock)
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(false);

      const mockClient = {
        chat: {
          completions: {
            create: jest.fn(),
          },
        },
      };

      await expect(
        analyzeFrames(mockImagePaths, mockApiKey, 'test', mockClient as any)
      ).rejects.toThrow('Frame 2 failed: File not found');
    });

    it('should create new OpenAI client when not provided', async () => {
      const mockBuffer = Buffer.from('fake-image-data');
      (fs.readFileSync as jest.Mock).mockReturnValue(mockBuffer);
      (fs.existsSync as jest.Mock).mockReturnValue(true);

      const mockCreate = jest.fn().mockResolvedValue({
        choices: [{ message: { content: 'Description' } }],
        usage: { prompt_tokens: 100, completion_tokens: 50 },
      });

      (OpenAI as jest.MockedClass<typeof OpenAI>).mockImplementation(() => ({
        chat: {
          completions: {
            create: mockCreate,
          },
        },
      } as any));

      await analyzeFrames([mockImagePath], mockApiKey, 'test');

      expect(OpenAI).toHaveBeenCalledWith({ apiKey: mockApiKey });
    });
  });
});
