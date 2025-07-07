import Redis from 'ioredis';
import { logger as Logger } from '../../utils/logger';

export class RedisService {
  private static instance: RedisService;
  private client: Redis | null = null;

  private constructor() {
    this.connect();
  }

  public static getInstance(): RedisService {
    if (!RedisService.instance) {
      RedisService.instance = new RedisService();
    }
    return RedisService.instance;
  }

  private async connect(): Promise<void> {
    try {
      if (!this.client) {
        this.client = new Redis({
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379'),
          password: process.env.REDIS_PASSWORD || '',
          retryStrategy: (times: number) => {
            const delay = Math.min(times * 50, 2000);
            return delay;
          }
        });

        this.client.on('error', (error: Error) => {
          Logger.error('Redis connection error:', { error: error.message });
        });

        this.client.on('connect', () => {
          Logger.info('Connected to Redis');
        });
      }
    } catch (error) {
      Logger.error('Failed to connect to Redis:', { error: error instanceof Error ? error.message : String(error) });
    }
  }

  public async get<T>(key: string): Promise<T | null> {
    try {
      if (!this.client) {
        return null;
      }

      const value = await this.client.get(key);
      if (!value) return null;

      try {
        return JSON.parse(value) as T;
      } catch {
        return null;
      }
    } catch (error) {
      Logger.error('Redis get error:', { error: error instanceof Error ? error.message : String(error) });
      return null;
    }
  }

  public async set(key: string, value: any, ttl?: number): Promise<boolean> {
    try {
      if (!this.client) {
        return false;
      }

      const stringValue = JSON.stringify(value);

      if (ttl) {
        await this.client.setex(key, ttl, stringValue);
      } else {
        await this.client.set(key, stringValue);
      }

      return true;
    } catch (error) {
      Logger.error('Redis set error:', { error: error instanceof Error ? error.message : String(error) });
      return false;
    }
  }

  public async del(key: string): Promise<boolean> {
    try {
      if (!this.client) {
        return false;
      }

      await this.client.del(key);
      return true;
    } catch (error) {
      Logger.error('Redis del error:', { error: error instanceof Error ? error.message : String(error) });
      return false;
    }
  }

  public async clearCache(): Promise<boolean> {
    try {
      if (!this.client) {
        return false;
      }

      await this.client.flushdb();
      return true;
    } catch (error) {
      Logger.error('Redis clear cache error:', { error: error instanceof Error ? error.message : String(error) });
      return false;
    }
  }

  public async disconnect(): Promise<void> {
    try {
      if (this.client) {
        await this.client.quit();
        this.client = null;
      }
    } catch (error) {
      Logger.error('Redis disconnect error:', { error: error instanceof Error ? error.message : String(error) });
    }
  }

  // For testing purposes only
  public setClient(client: Redis): void {
    if (this.client) {
      this.client.removeAllListeners?.();
    }
    this.client = client;
  }
} 