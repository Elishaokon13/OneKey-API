import { RedisService } from '../services/cache/redisService';
import { closePool } from '../config/database';

export default async function teardown() {
  const redis = RedisService.getInstance();

  try {
    // Close database pool
    await closePool();

    // Disconnect Redis
    await redis.disconnect();
  } catch (error) {
    console.error('Failed to clean up services:', error);
    process.exit(1);
  }
} 