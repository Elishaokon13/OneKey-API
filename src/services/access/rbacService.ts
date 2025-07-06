// OneKey KYC API - Role-based Access Control Service

import { Pool } from 'pg';
import {
  Role,
  Permission,
  RoleDefinition,
  Effect,
  AccessRequest,
  AccessResponse
} from '@/types/accessControl';
import { logger } from '@/utils/logger';

export class RBACService {
  private readonly pool: Pool;
  private roleDefinitions: Map<Role, RoleDefinition>;

  constructor(pool: Pool) {
    this.pool = pool;
    this.roleDefinitions = new Map();
    this.initializeRoleDefinitions();
  }

  /**
   * Initialize default role definitions
   */
  private initializeRoleDefinitions(): void {
    // Admin role
    this.roleDefinitions.set(Role.ADMIN, {
      name: Role.ADMIN,
      permissions: Object.values(Permission),
      description: 'Full system access with all permissions'
    });

    // Manager role
    this.roleDefinitions.set(Role.MANAGER, {
      name: Role.MANAGER,
      permissions: [
        Permission.READ_PROJECT,
        Permission.UPDATE_PROJECT,
        Permission.CREATE_KYC,
        Permission.READ_KYC,
        Permission.UPDATE_KYC,
        Permission.ENCRYPT_DATA,
        Permission.DECRYPT_DATA,
        Permission.VIEW_ANALYTICS
      ],
      description: 'Project management and operations'
    });

    // Operator role
    this.roleDefinitions.set(Role.OPERATOR, {
      name: Role.OPERATOR,
      permissions: [
        Permission.READ_PROJECT,
        Permission.CREATE_KYC,
        Permission.READ_KYC,
        Permission.ENCRYPT_DATA,
        Permission.DECRYPT_DATA
      ],
      description: 'Day-to-day operations'
    });

    // Viewer role
    this.roleDefinitions.set(Role.VIEWER, {
      name: Role.VIEWER,
      permissions: [
        Permission.READ_PROJECT,
        Permission.READ_KYC,
        Permission.VIEW_ANALYTICS
      ],
      description: 'Read-only access'
    });
  }

  /**
   * Get role definition
   */
  public getRoleDefinition(role: Role): RoleDefinition | undefined {
    return this.roleDefinitions.get(role);
  }

  /**
   * Check if role has permission
   */
  public hasPermission(role: Role, permission: Permission): boolean {
    const definition = this.roleDefinitions.get(role);
    return definition?.permissions.includes(permission) || false;
  }

  /**
   * Assign role to user
   */
  public async assignRole(
    userId: string,
    role: Role,
    projectId: string,
    assignedBy: string
  ): Promise<void> {
    try {
      await this.pool.query(
        `INSERT INTO user_roles (user_id, role, project_id, assigned_by, assigned_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [userId, role, projectId, assignedBy]
      );

      logger.info('Role assigned successfully', {
        userId,
        role,
        projectId,
        assignedBy
      });
    } catch (error) {
      logger.error('Failed to assign role', { error, userId, role });
      throw error;
    }
  }

  /**
   * Remove role from user
   */
  public async removeRole(
    userId: string,
    role: Role,
    projectId: string,
    removedBy: string
  ): Promise<void> {
    try {
      await this.pool.query(
        `UPDATE user_roles 
         SET active = false, removed_by = $4, removed_at = NOW()
         WHERE user_id = $1 AND role = $2 AND project_id = $3 AND active = true`,
        [userId, role, projectId, removedBy]
      );

      logger.info('Role removed successfully', {
        userId,
        role,
        projectId,
        removedBy
      });
    } catch (error) {
      logger.error('Failed to remove role', { error, userId, role });
      throw error;
    }
  }

  /**
   * Get user's roles
   */
  public async getUserRoles(userId: string, projectId: string): Promise<Role[]> {
    try {
      const result = await this.pool.query(
        `SELECT role 
         FROM user_roles 
         WHERE user_id = $1 AND project_id = $2 AND active = true`,
        [userId, projectId]
      );

      return result.rows.map(row => row.role as Role);
    } catch (error) {
      logger.error('Failed to get user roles', { error, userId });
      throw error;
    }
  }

  /**
   * Check access based on RBAC
   */
  public async checkAccess(request: AccessRequest): Promise<AccessResponse> {
    try {
      const { subject, action } = request;
      const roles = subject.roles || [];

      // Check if any of the user's roles have the required permission
      const hasAccess = roles.some(role => this.hasPermission(role, action));

      if (hasAccess) {
        return {
          allowed: true,
          reason: 'Role-based permission granted',
          auditLog: {
            requestId: crypto.randomUUID(),
            timestamp: new Date(),
            decision: Effect.ALLOW,
            matchedPolicies: roles.map(role => `rbac:${role}`)
          }
        };
      }

      return {
        allowed: false,
        reason: 'No role with required permission',
        auditLog: {
          requestId: crypto.randomUUID(),
          timestamp: new Date(),
          decision: Effect.DENY,
          matchedPolicies: []
        }
      };
    } catch (error) {
      logger.error('Failed to check RBAC access', { error, request });
      throw error;
    }
  }

  /**
   * Get role hierarchy
   */
  public getRoleHierarchy(): Map<Role, Role[]> {
    const hierarchy = new Map<Role, Role[]>();
    
    // Define role inheritance
    hierarchy.set(Role.ADMIN, [Role.MANAGER, Role.OPERATOR, Role.VIEWER]);
    hierarchy.set(Role.MANAGER, [Role.OPERATOR, Role.VIEWER]);
    hierarchy.set(Role.OPERATOR, [Role.VIEWER]);
    hierarchy.set(Role.VIEWER, []);

    return hierarchy;
  }

  /**
   * Get inherited permissions
   */
  public getInheritedPermissions(role: Role): Permission[] {
    const hierarchy = this.getRoleHierarchy();
    const inheritedRoles = hierarchy.get(role) || [];
    
    const permissions = new Set<Permission>();
    
    // Add direct permissions
    const directPerms = this.roleDefinitions.get(role)?.permissions || [];
    directPerms.forEach(perm => permissions.add(perm));
    
    // Add inherited permissions
    inheritedRoles.forEach(inheritedRole => {
      const inheritedPerms = this.roleDefinitions.get(inheritedRole)?.permissions || [];
      inheritedPerms.forEach(perm => permissions.add(perm));
    });

    return Array.from(permissions);
  }
} 