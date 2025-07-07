import { RedisService } from '../services/cache/redisService';
import { Pool } from 'pg';
import { config } from '../config/database';

export default async function globalSetup() {
  const redis = RedisService.getInstance();
  const pool = new Pool(config);

  try {
    // Test Redis connection
    await redis.set('test', 'test');
    await redis.del('test');

    // Test database connection
    await pool.query('SELECT 1');
  } catch (error) {
    console.error('Failed to connect to services:', error);
    process.exit(1);
  }
} 