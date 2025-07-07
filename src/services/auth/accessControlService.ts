import { Pool } from 'pg';
import { RateLimitService } from '../access/rateLimitService';
import { RedisService } from '../cache/redisService';
import { Logger } from '../../utils/logger';
import { AccessControlError } from '../../utils/errors';
import { AccessControlPolicy, AccessLevel, ProjectType } from '../../types/accessControl';

export class AccessControlService {
  private static instance: AccessControlService;
  private pool: Pool;
  private redisService: RedisService;
  private rateLimitService: RateLimitService;

  private constructor(pool: Pool) {
    this.pool = pool;
    this.redisService = RedisService.getInstance();
    this.rateLimitService = RateLimitService.getInstance();
  }

  public static getInstance(pool: Pool): AccessControlService {
    if (!AccessControlService.instance) {
      AccessControlService.instance = new AccessControlService(pool);
    }
    return AccessControlService.instance;
  }

  public async checkAccess(userId: string, projectId: string, requiredLevel: AccessLevel): Promise<boolean> {
    try {
      // Check rate limits first
      if (await this.rateLimitService.isRateLimited(userId, projectId)) {
        throw new AccessControlError('Rate limit exceeded');
      }

      // Increment request count
      await this.rateLimitService.incrementRequestCount(userId, projectId);

      // Check access level
      const policy = await this.getPolicy(userId, projectId);
      if (!policy) {
        return false;
      }

      const hasAccess = this.evaluatePolicy(policy, requiredLevel);
      if (!hasAccess) {
        Logger.warn('Access denied', { userId, projectId, requiredLevel });
      }

      return hasAccess;
    } catch (error) {
      if (error instanceof AccessControlError) {
        throw error;
      }
      Logger.error('Access check failed', { error });
      return false;
    }
  }

  private async getPolicy(userId: string, projectId: string): Promise<AccessControlPolicy | null> {
    const cacheKey = `policy:${userId}:${projectId}`;
    try {
      // Try cache first
      const cachedPolicy = await this.redisService.get<AccessControlPolicy>(cacheKey);
      if (cachedPolicy) {
        return cachedPolicy;
      }

      // Query database
      const result = await this.pool.query(
        'SELECT * FROM access_control_policies WHERE user_id = $1 AND project_id = $2',
        [userId, projectId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const policy = result.rows[0] as AccessControlPolicy;
      
      // Cache policy
      await this.redisService.set(cacheKey, policy, 300); // Cache for 5 minutes
      
      return policy;
    } catch (error) {
      Logger.error('Failed to get policy', { error });
      return null;
    }
  }

  private evaluatePolicy(policy: AccessControlPolicy, requiredLevel: AccessLevel): boolean {
    // Basic level check
    if (policy.accessLevel >= requiredLevel) {
      return true;
    }

    // Check project type specific rules
    if (policy.projectType === ProjectType.WEB3) {
      return this.evaluateWeb3Policy(policy, requiredLevel);
    }

    return false;
  }

  private evaluateWeb3Policy(policy: AccessControlPolicy, requiredLevel: AccessLevel): boolean {
    // Add Web3 specific policy evaluation logic here
    // For example, checking token holdings, NFT ownership, etc.
    return false;
  }
} 