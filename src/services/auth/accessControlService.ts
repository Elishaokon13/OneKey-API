import { Knex } from 'knex';
import { RBACConfig, ABACConfig, Permission, Role } from '../../types/access-control';
import { knex } from '../../config/database';
import { RedisService } from '../cache/redisService';
import { AuditLogQueue } from '../analytics/auditLogQueue';
import { config } from '@/config/environment';
import { logger } from '@/utils/logger';

export class AccessControlService {
  private db: Knex;
  private redis: RedisService;
  private auditLogQueue: AuditLogQueue;
  private readonly RBAC_CACHE_TTL = 3600; // 1 hour
  private readonly ABAC_CACHE_TTL = 3600; // 1 hour
  private readonly USER_CACHE_TTL = 900; // 15 minutes

  constructor(transaction?: Knex.Transaction) {
    this.db = transaction || knex;
    this.redis = RedisService.getInstance();
    this.auditLogQueue = AuditLogQueue.getInstance();
  }

  async getRBACConfig(projectId: string): Promise<RBACConfig | null> {
    const cacheKey = `rbac:${projectId}`;
    
    if (this.redis.isEnabled()) {
      const cached = await this.redis.get<RBACConfig>(cacheKey);
      if (cached) {
        logger.debug('RBAC config cache hit', { projectId });
        return cached;
      }
    }

    const result = await this.db('mv_project_rbac_config')
      .where({ project_id: projectId })
      .first();
    
    const config = result?.rbac_config as RBACConfig;
    
    if (config && this.redis.isEnabled()) {
      await this.redis.set(cacheKey, config, this.RBAC_CACHE_TTL);
      logger.debug('RBAC config cached', { projectId });
    }

    return config;
  }

  async getABACConfig(projectId: string): Promise<ABACConfig | null> {
    const cacheKey = `abac:${projectId}`;
    
    if (this.redis.isEnabled()) {
      const cached = await this.redis.get<ABACConfig>(cacheKey);
      if (cached) {
        logger.debug('ABAC config cache hit', { projectId });
        return cached;
      }
    }

    const result = await this.db('mv_project_abac_config')
      .where({ project_id: projectId })
      .first();
    
    const config = result?.abac_config as ABACConfig;
    
    if (config && this.redis.isEnabled()) {
      await this.redis.set(cacheKey, config, this.ABAC_CACHE_TTL);
      logger.debug('ABAC config cached', { projectId });
    }

    return config;
  }

  async getUserRoles(userId: string): Promise<string[]> {
    const cacheKey = `user:roles:${userId}`;
    
    if (this.redis.isEnabled()) {
      const cached = await this.redis.get<string[]>(cacheKey);
      if (cached) {
        logger.debug('User roles cache hit', { userId });
        return cached;
      }
    }

    const roles = await this.db('mv_user_roles')
      .where({ user_id: userId, active: true })
      .pluck('role');
    
    if (roles.length && this.redis.isEnabled()) {
      await this.redis.set(cacheKey, roles, this.USER_CACHE_TTL);
      logger.debug('User roles cached', { userId });
    }

    return roles;
  }

  async getUserAttributes(userId: string): Promise<Record<string, any>> {
    const cacheKey = `user:attributes:${userId}`;
    
    if (this.redis.isEnabled()) {
      const cached = await this.redis.get<Record<string, any>>(cacheKey);
      if (cached) {
        logger.debug('User attributes cache hit', { userId });
        return cached;
      }
    }

    const result = await this.db('mv_user_attributes')
      .where({ user_id: userId })
      .first();
    
    const attributes = result?.attributes ? JSON.parse(result.attributes) : {};
    
    if (Object.keys(attributes).length && this.redis.isEnabled()) {
      await this.redis.set(cacheKey, attributes, this.USER_CACHE_TTL);
      logger.debug('User attributes cached', { userId });
    }

    return attributes;
  }

  async hasPermission(userId: string, projectId: string, requiredPermission: Permission): Promise<boolean> {
    // First check Redis cache
    const cacheKey = `permission:${userId}:${projectId}:${requiredPermission}`;
    
    if (this.redis.isEnabled()) {
      const cached = await this.redis.get<boolean>(cacheKey);
      if (cached !== null) {
        logger.debug('Permission check cache hit', { userId, requiredPermission });
        return cached;
      }
    }

    // Check materialized view for direct permission
    const hasDirectPermission = await this.db('mv_user_permissions')
      .where({
        user_id: userId,
        project_id: projectId,
        permission: requiredPermission
      })
      .first()
      .then(result => !!result);

    if (hasDirectPermission) {
      if (this.redis.isEnabled()) {
        await this.redis.set(cacheKey, true, this.USER_CACHE_TTL);
      }
      return true;
    }

    // Check for wildcard permissions
    const hasWildcardPermission = await this.db('mv_user_permissions')
      .where({
        user_id: userId,
        project_id: projectId,
        permission: 'all:*'
      })
      .orWhere({
        user_id: userId,
        project_id: projectId,
        permission: `${requiredPermission.split(':')[0]}:*`
      })
      .first()
      .then(result => !!result);

    if (this.redis.isEnabled()) {
      await this.redis.set(cacheKey, hasWildcardPermission, this.USER_CACHE_TTL);
    }

    return hasWildcardPermission;
  }

  async evaluateABACRules(
    userId: string, 
    projectId: string, 
    context: Record<string, any>
  ): Promise<boolean> {
    const [userRoles, userAttributes, abacConfig] = await Promise.all([
      this.getUserRoles(userId),
      this.getUserAttributes(userId),
      this.getABACConfig(projectId)
    ]);

    if (!abacConfig?.enabled) {
      return false;
    }

    // Evaluate each ABAC rule
    for (const rule of abacConfig.rules) {
      const conditions = rule.conditions;

      // Check required roles if specified
      if (conditions.requiredRoles?.length) {
        const hasRequiredRole = conditions.requiredRoles.some((role: string) => 
          userRoles.includes(role)
        );
        if (!hasRequiredRole) continue;
      }

      // Check all other conditions
      const contextMatch = Object.entries(conditions).every(([key, value]) => {
        if (key === 'requiredRoles') return true; // Already checked
        
        // Check user attributes
        if (key in userAttributes) {
          return userAttributes[key] === value;
        }
        
        // Check context attributes
        if (key in context) {
          return context[key] === value;
        }
        
        return false;
      });

      if (contextMatch) return true;
    }

    return false;
  }

  async logAccessAttempt(
    userId: string,
    projectId: string,
    action: string,
    allowed: boolean,
    context: Record<string, any>
  ): Promise<void> {
    await this.auditLogQueue.enqueue({
      user_id: userId,
      project_id: projectId,
      action,
      allowed,
      details: context,
      created_at: new Date()
    });
  }

  /**
   * Invalidate cached RBAC configuration for a project
   */
  public async invalidateRBACCache(projectId: string): Promise<void> {
    if (this.redis.isEnabled()) {
      await this.redis.del(`rbac:${projectId}`);
      logger.debug('RBAC config cache invalidated', { projectId });
    }
  }

  /**
   * Invalidate cached ABAC configuration for a project
   */
  public async invalidateABACCache(projectId: string): Promise<void> {
    if (this.redis.isEnabled()) {
      await this.redis.del(`abac:${projectId}`);
      logger.debug('ABAC config cache invalidated', { projectId });
    }
  }

  /**
   * Invalidate cached user data
   */
  public async invalidateUserCache(userId: string): Promise<void> {
    if (this.redis.isEnabled()) {
      await Promise.all([
        this.redis.del(`user:roles:${userId}`),
        this.redis.del(`user:attributes:${userId}`)
      ]);
      logger.debug('User cache invalidated', { userId });
    }
  }
} 