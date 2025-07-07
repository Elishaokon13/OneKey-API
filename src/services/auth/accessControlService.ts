import { Knex } from 'knex';
import { RBACConfig, ABACConfig, Permission, Role } from '../../types/access-control';
import { knex } from '../../config/database';
import { RedisService } from '../cache/redisService';
import { config } from '@/config/environment';
import { logger } from '@/utils/logger';

export class AccessControlService {
  private db: Knex;
  private redis: RedisService;
  private readonly RBAC_CACHE_TTL = 3600; // 1 hour
  private readonly ABAC_CACHE_TTL = 3600; // 1 hour
  private readonly USER_CACHE_TTL = 900; // 15 minutes

  constructor(transaction?: Knex.Transaction) {
    this.db = transaction || knex;
    this.redis = RedisService.getInstance();
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

    const result = await this.db('project_settings')
      .where({ project_id: projectId, key: 'rbac_config' })
      .first();
    
    const config = result?.value as RBACConfig;
    
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

    const result = await this.db('project_settings')
      .where({ project_id: projectId, key: 'abac_config' })
      .first();
    
    const config = result?.value as ABACConfig;
    
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

    const user = await this.db('users')
      .where({ id: userId })
      .select('metadata')
      .first();
    
    const roles = user?.metadata?.roles || [];
    
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

    const user = await this.db('users')
      .where({ id: userId })
      .select('metadata')
      .first();
    
    const attributes = user?.metadata?.attributes || {};
    
    if (Object.keys(attributes).length && this.redis.isEnabled()) {
      await this.redis.set(cacheKey, attributes, this.USER_CACHE_TTL);
      logger.debug('User attributes cached', { userId });
    }

    return attributes;
  }

  async hasPermission(userId: string, projectId: string, requiredPermission: Permission): Promise<boolean> {
    const [userRoles, rbacConfig] = await Promise.all([
      this.getUserRoles(userId),
      this.getRBACConfig(projectId)
    ]);

    if (!rbacConfig?.enabled || !userRoles.length) {
      return false;
    }

    // Check each role's permissions
    for (const roleName of userRoles) {
      if (this.checkRolePermission(roleName, requiredPermission, rbacConfig.roles)) {
        return true;
      }
    }

    return false;
  }

  private checkRolePermission(roleName: string, requiredPermission: Permission, roles: Record<string, Role>): boolean {
    const role = roles[roleName];
    if (!role) return false;

    // Check direct permissions
    if (this.roleHasPermission(role, requiredPermission)) {
      return true;
    }

    // Check parent role if exists
    if (role.parent && roles[role.parent]) {
      return this.checkRolePermission(role.parent, requiredPermission, roles);
    }

    return false;
  }

  private roleHasPermission(role: Role, requiredPermission: Permission): boolean {
    return role.permissions.some((permission: Permission) => {
      // Check for wildcard permissions
      if (permission === 'all:*') return true;
      
      const [resource, action] = permission.split(':');
      const [reqResource, reqAction] = requiredPermission.split(':');
      
      return (resource === reqResource || resource === 'all') && 
             (action === reqAction || action === '*');
    });
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
    await this.db('audit_logs').insert({
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