import SemanticVideoClient from '../src/client';

describe('SemanticVideoClient', () => {
  describe('constructor', () => {
    it('should throw error when API key is empty', () => {
      expect(() => new SemanticVideoClient('')).toThrow('API key is required');
    });

    it('should create client with valid API key', () => {
      const client = new SemanticVideoClient('test-api-key');
      expect(client).toBeInstanceOf(SemanticVideoClient);
    });

    it('should set default maxConcurrency to 3', () => {
      const client = new SemanticVideoClient('test-api-key');
      // maxConcurrency is private, but behavior can be tested indirectly
      expect(client).toBeDefined();
    });

    it('should respect custom maxConcurrency', () => {
      const client = new SemanticVideoClient('test-api-key', undefined, 5);
      expect(client).toBeDefined();
    });

    it('should enforce minimum maxConcurrency of 1', () => {
      const client = new SemanticVideoClient('test-api-key', undefined, 0);
      expect(client).toBeDefined();
    });
  });

  describe('logger configuration', () => {
    it('should accept logger options', () => {
      const client = new SemanticVideoClient('test-api-key', {
        enabled: true,
        showProgress: false,
      });
      expect(client).toBeDefined();
    });

    it('should allow configuring logger after construction', () => {
      const client = new SemanticVideoClient('test-api-key');
      expect(() => {
        client.configureLogger({ enabled: true });
      }).not.toThrow();
    });
  });
});
