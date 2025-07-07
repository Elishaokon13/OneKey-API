import { RedisService } from '../cache/redisService';
import { logger as Logger } from '../../utils/logger';

export class RateLimitService {
  private static instance: RateLimitService;
  private redisService: RedisService;
  private readonly requestLimit: number = 50;
  private readonly blockDuration: number = 300; // 5 minutes in seconds

  private constructor() {
    this.redisService = RedisService.getInstance();
  }

  public static getInstance(): RateLimitService {
    if (!RateLimitService.instance) {
      RateLimitService.instance = new RateLimitService();
    }
    return RateLimitService.instance;
  }

  public async isRateLimited(userId: string, projectId: string): Promise<boolean> {
    const key = this.getRateLimitKey(userId, projectId);
    try {
      const requestCount = await this.redisService.get<number>(key) || 0;
      return requestCount >= this.requestLimit;
    } catch (error) {
      Logger.error('Rate limit check failed', { error });
      return false; // Fail open on errors
    }
  }

  public async incrementRequestCount(userId: string, projectId: string): Promise<void> {
    const key = this.getRateLimitKey(userId, projectId);
    try {
      const requestCount = await this.redisService.get<number>(key) || 0;
      await this.redisService.set(key, requestCount + 1, this.blockDuration);
    } catch (error) {
      Logger.error('Failed to increment request count', { error });
    }
  }

  public async blockUser(userId: string, projectId: string): Promise<void> {
    const key = this.getRateLimitKey(userId, projectId);
    try {
      await this.redisService.set(key, this.requestLimit, this.blockDuration);
    } catch (error) {
      Logger.error('Failed to block user', { error });
    }
  }

  public async resetLimits(userId: string, projectId: string): Promise<void> {
    const key = this.getRateLimitKey(userId, projectId);
    try {
      await this.redisService.del(key);
    } catch (error) {
      Logger.error('Failed to reset rate limits', { error });
    }
  }

  private getRateLimitKey(userId: string, projectId: string): string {
    return `rate_limit:${userId}:${projectId}`;
  }
} 