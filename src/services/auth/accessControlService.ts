import { Knex } from 'knex';
import { RBACConfig, ABACConfig, Permission, Role } from '../../types/access-control';
import { db } from '../../config/database';

export class AccessControlService {
  private db: Knex;

  constructor(transaction?: Knex.Transaction) {
    this.db = transaction || db;
  }

  async getRBACConfig(projectId: string): Promise<RBACConfig | null> {
    const result = await this.db('project_settings')
      .where({ project_id: projectId, key: 'rbac_config' })
      .first();
    return result?.value as RBACConfig;
  }

  async getABACConfig(projectId: string): Promise<ABACConfig | null> {
    const result = await this.db('project_settings')
      .where({ project_id: projectId, key: 'abac_config' })
      .first();
    return result?.value as ABACConfig;
  }

  async getUserRoles(userId: string): Promise<string[]> {
    const user = await this.db('users')
      .where({ id: userId })
      .select('metadata')
      .first();
    return user?.metadata?.roles || [];
  }

  async getUserAttributes(userId: string): Promise<Record<string, any>> {
    const user = await this.db('users')
      .where({ id: userId })
      .select('metadata')
      .first();
    return user?.metadata?.attributes || {};
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
      const role = rbacConfig.roles[roleName];
      if (!role) continue;

      // Direct permission check
      if (this.roleHasPermission(role, requiredPermission)) {
        return true;
      }

      // Check parent role if exists
      if (role.parent && rbacConfig.roles[role.parent]) {
        const parentRole = rbacConfig.roles[role.parent];
        if (this.roleHasPermission(parentRole, requiredPermission)) {
          return true;
        }
      }
    }

    return false;
  }

  private roleHasPermission(role: Role, requiredPermission: Permission): boolean {
    return role.permissions.some(permission => {
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
        const hasRequiredRole = conditions.requiredRoles.some(role => 
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
} 