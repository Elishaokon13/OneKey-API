import { config } from '../config/environment';
import { RedisService } from '../services/cache/redisService';

// Configure Redis for testing
config.redis = {
  enabled: true,
  host: process.env.TEST_REDIS_HOST || 'localhost',
  port: parseInt(process.env.TEST_REDIS_PORT || '6379', 10),
  password: process.env.TEST_REDIS_PASSWORD || '',
  db: parseInt(process.env.TEST_REDIS_DB || '1', 10), // Use a different DB for tests
  ttl: 3600,
  keyPrefix: 'test:'
};

// Clear Redis cache before tests
beforeAll(async () => {
  const redis = RedisService.getInstance();
  if (redis.isEnabled()) {
    await redis.clearCache();
  }
});

// Disconnect Redis after tests
afterAll(async () => {
  const redis = RedisService.getInstance();
  await redis.disconnect();
}); 