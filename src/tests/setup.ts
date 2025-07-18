import { RedisService } from '../services/cache/redisService';
import { Pool } from 'pg';
import { config } from '../config/database';

export default async function setup() {
  const redis = RedisService.getInstance();
  const pool = new Pool(config);

  try {
    // Test database connection
    await pool.query('SELECT 1');
  } catch (error) {
    console.error('Failed to connect to database:', error);
    process.exit(1);
  }
} 