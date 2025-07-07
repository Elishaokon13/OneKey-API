import Redis from 'ioredis';
import { config } from '@/config/environment';
import { logger } from '@/utils/logger';

export class RedisService {
  private static instance: RedisService;
  private client: Redis | null = null;

  private constructor() {
    if (config.redis.enabled) {
      this.initialize();
    }
  }

  public static getInstance(): RedisService {
    if (!RedisService.instance) {
      RedisService.instance = new RedisService();
    }
    return RedisService.instance;
  }

  private initialize(): void {
    try {
      this.client = new Redis({
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password || undefined,
        db: config.redis.db,
        keyPrefix: config.redis.keyPrefix,
        retryStrategy: (times: number): number => {
          return Math.min(times * 50, 2000);
        }
      } as Redis.RedisOptions);

      this.client.on('connect', () => {
        logger.info('Redis client connected successfully');
      });

      this.client.on('error', (error: Error) => {
        logger.error('Redis client error:', { error: error.message });
      });
    } catch (error) {
      logger.error('Failed to initialize Redis client:', { error: error instanceof Error ? error.message : String(error) });
      this.client = null;
    }
  }

  public async get<T>(key: string): Promise<T | null> {
    if (!this.client || !config.redis.enabled) return null;

    try {
      const value = await this.client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error(`Error getting key ${key} from Redis:`, { error: error instanceof Error ? error.message : String(error) });
      return null;
    }
  }

  public async set(key: string, value: any, ttl?: number): Promise<boolean> {
    if (!this.client || !config.redis.enabled) return false;

    try {
      const serializedValue = JSON.stringify(value);
      if (ttl) {
        await this.client.setex(key, ttl, serializedValue);
      } else {
        await this.client.set(key, serializedValue);
      }
      return true;
    } catch (error) {
      logger.error(`Error setting key ${key} in Redis:`, { error: error instanceof Error ? error.message : String(error) });
      return false;
    }
  }

  public async del(key: string): Promise<boolean> {
    if (!this.client || !config.redis.enabled) return false;

    try {
      await this.client.del(key);
      return true;
    } catch (error) {
      logger.error(`Error deleting key ${key} from Redis:`, { error: error instanceof Error ? error.message : String(error) });
      return false;
    }
  }

  public async clearCache(): Promise<boolean> {
    if (!this.client || !config.redis.enabled) return false;

    try {
      await this.client.flushdb();
      return true;
    } catch (error) {
      logger.error('Error clearing Redis cache:', { error: error instanceof Error ? error.message : String(error) });
      return false;
    }
  }

  public isEnabled(): boolean {
    return config.redis.enabled && this.client !== null;
  }

  public getClient(): Redis | null {
    return this.client;
  }

  public async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
    }
  }
} 