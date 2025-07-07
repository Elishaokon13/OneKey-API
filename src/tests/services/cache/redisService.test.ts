import { RedisService } from '../../../services/cache/redisService';
import Redis from 'ioredis';

jest.mock('ioredis');

describe('RedisService', () => {
  let redisService: RedisService;
  let mockRedisClient: jest.Mocked<Redis>;

  beforeEach(() => {
    mockRedisClient = {
      get: jest.fn(),
      set: jest.fn(),
      setex: jest.fn(),
      del: jest.fn(),
      flushdb: jest.fn(),
      quit: jest.fn(),
      on: jest.fn(),
      connect: jest.fn()
    } as unknown as jest.Mocked<Redis>;

    redisService = RedisService.getInstance();
    redisService.setClient(mockRedisClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('get', () => {
    it('should return parsed value when key exists', async () => {
      const testKey = 'test-key';
      const testValue = { foo: 'bar' };
      mockRedisClient.get.mockResolvedValue(JSON.stringify(testValue));

      const result = await redisService.get<typeof testValue>(testKey);
      expect(result).toEqual(testValue);
      expect(mockRedisClient.get).toHaveBeenCalledWith(testKey);
    });

    it('should return null when key does not exist', async () => {
      const testKey = 'non-existent-key';
      mockRedisClient.get.mockResolvedValue(null);

      const result = await redisService.get(testKey);
      expect(result).toBeNull();
      expect(mockRedisClient.get).toHaveBeenCalledWith(testKey);
    });

    it('should handle invalid JSON', async () => {
      const testKey = 'invalid-json-key';
      mockRedisClient.get.mockResolvedValue('invalid json');

      const result = await redisService.get(testKey);
      expect(result).toBeNull();
      expect(mockRedisClient.get).toHaveBeenCalledWith(testKey);
    });

    it('should handle Redis errors', async () => {
      const testKey = 'error-key';
      mockRedisClient.get.mockRejectedValue(new Error('Redis error'));

      const result = await redisService.get(testKey);
      expect(result).toBeNull();
      expect(mockRedisClient.get).toHaveBeenCalledWith(testKey);
    });
  });

  describe('set', () => {
    it('should set value with TTL when provided', async () => {
      const testKey = 'test-key';
      const testValue = { foo: 'bar' };
      const ttl = 3600;
      mockRedisClient.setex.mockResolvedValue('OK');

      const result = await redisService.set(testKey, testValue, ttl);
      expect(result).toBe(true);
      expect(mockRedisClient.setex).toHaveBeenCalledWith(
        testKey,
        ttl,
        JSON.stringify(testValue)
      );
    });

    it('should set value without TTL', async () => {
      const testKey = 'test-key';
      const testValue = { foo: 'bar' };
      mockRedisClient.set.mockResolvedValue('OK');

      const result = await redisService.set(testKey, testValue);
      expect(result).toBe(true);
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        testKey,
        JSON.stringify(testValue)
      );
    });

    it('should handle Redis errors', async () => {
      const testKey = 'error-key';
      const testValue = { foo: 'bar' };
      mockRedisClient.set.mockRejectedValue(new Error('Redis error'));

      const result = await redisService.set(testKey, testValue);
      expect(result).toBe(false);
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        testKey,
        JSON.stringify(testValue)
      );
    });
  });

  describe('del', () => {
    it('should delete key successfully', async () => {
      const testKey = 'test-key';
      mockRedisClient.del.mockResolvedValue(1);

      const result = await redisService.del(testKey);
      expect(result).toBe(true);
      expect(mockRedisClient.del).toHaveBeenCalledWith(testKey);
    });

    it('should handle Redis errors', async () => {
      const testKey = 'error-key';
      mockRedisClient.del.mockRejectedValue(new Error('Redis error'));

      const result = await redisService.del(testKey);
      expect(result).toBe(false);
      expect(mockRedisClient.del).toHaveBeenCalledWith(testKey);
    });
  });

  describe('clearCache', () => {
    it('should clear cache successfully', async () => {
      mockRedisClient.flushdb.mockResolvedValue('OK');

      const result = await redisService.clearCache();
      expect(result).toBe(true);
      expect(mockRedisClient.flushdb).toHaveBeenCalled();
    });

    it('should handle Redis errors', async () => {
      mockRedisClient.flushdb.mockRejectedValue(new Error('Redis error'));

      const result = await redisService.clearCache();
      expect(result).toBe(false);
      expect(mockRedisClient.flushdb).toHaveBeenCalled();
    });
  });

  describe('disconnect', () => {
    it('should disconnect successfully', async () => {
      mockRedisClient.quit.mockResolvedValue('OK');

      await redisService.disconnect();
      expect(mockRedisClient.quit).toHaveBeenCalled();
    });
  });
}); 