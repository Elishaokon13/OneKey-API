import { RedisService } from '../../../services/cache/redisService';
import { config } from '../../../config/environment';

describe('RedisService', () => {
  let redisService: RedisService;

  beforeAll(() => {
    // Enable Redis for tests
    config.redis.enabled = true;
    redisService = RedisService.getInstance();
  });

  afterAll(async () => {
    await redisService.disconnect();
  });

  beforeEach(async () => {
    await redisService.clearCache();
  });

  describe('Basic Operations', () => {
    it('should set and get a value', async () => {
      const key = 'test:key';
      const value = { foo: 'bar' };

      const setResult = await redisService.set(key, value);
      expect(setResult).toBe(true);

      const result = await redisService.get<typeof value>(key);
      expect(result).toEqual(value);
    });

    it('should set a value with TTL', async () => {
      const key = 'test:ttl';
      const value = { foo: 'bar' };
      const ttl = 1; // 1 second

      await redisService.set(key, value, ttl);
      
      // Value should exist initially
      let result = await redisService.get<typeof value>(key);
      expect(result).toEqual(value);

      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Value should be null after TTL
      result = await redisService.get<typeof value>(key);
      expect(result).toBeNull();
    });

    it('should delete a value', async () => {
      const key = 'test:delete';
      const value = { foo: 'bar' };

      await redisService.set(key, value);
      const deleteResult = await redisService.del(key);
      expect(deleteResult).toBe(true);

      const result = await redisService.get<typeof value>(key);
      expect(result).toBeNull();
    });

    it('should clear all values', async () => {
      const keys = ['test:1', 'test:2', 'test:3'];
      const value = { foo: 'bar' };

      // Set multiple values
      await Promise.all(keys.map(key => redisService.set(key, value)));

      // Clear cache
      const clearResult = await redisService.clearCache();
      expect(clearResult).toBe(true);

      // All values should be null
      const results = await Promise.all(keys.map(key => redisService.get<typeof value>(key)));
      results.forEach(result => expect(result).toBeNull());
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid JSON gracefully', async () => {
      const key = 'test:invalid';
      const client = redisService.getClient();
      
      // Manually set invalid JSON
      if (client) {
        await client.set(key, 'invalid json');
      }

      const result = await redisService.get(key);
      expect(result).toBeNull();
    });

    it('should handle Redis client errors gracefully', async () => {
      // Force disconnect Redis client
      await redisService.disconnect();

      const key = 'test:error';
      const value = { foo: 'bar' };

      const setResult = await redisService.set(key, value);
      expect(setResult).toBe(false);

      const getResult = await redisService.get(key);
      expect(getResult).toBeNull();

      const deleteResult = await redisService.del(key);
      expect(deleteResult).toBe(false);

      const clearResult = await redisService.clearCache();
      expect(clearResult).toBe(false);
    });
  });

  describe('Configuration', () => {
    it('should respect Redis enabled flag', async () => {
      // Disable Redis
      config.redis.enabled = false;

      const key = 'test:disabled';
      const value = { foo: 'bar' };

      const setResult = await redisService.set(key, value);
      expect(setResult).toBe(false);

      const getResult = await redisService.get(key);
      expect(getResult).toBeNull();

      // Re-enable Redis for other tests
      config.redis.enabled = true;
    });

    it('should use configured key prefix', async () => {
      const key = 'test:prefix';
      const value = { foo: 'bar' };
      const client = redisService.getClient();

      await redisService.set(key, value);

      if (client) {
        // Check if key exists with prefix
        const exists = await client.exists(config.redis.keyPrefix + key);
        expect(exists).toBe(1);
      }
    });
  });
}); 