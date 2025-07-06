// OneKey KYC API - Access Control Middleware

import { Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import {
  AccessRequest,
  Permission,
  SubjectAttributes,
  ResourceAttributes,
  EnvironmentAttributes
} from '@/types/accessControl';
import { PolicyEngine } from '@/services/access/policyEngine';
import { logger } from '@/utils/logger';

export class AccessControlMiddleware {
  private readonly policyEngine: PolicyEngine;

  constructor(pool: Pool) {
    this.policyEngine = new PolicyEngine(pool);
  }

  /**
   * Build subject attributes from request
   */
  private buildSubjectAttributes(req: Request): SubjectAttributes {
    return {
      roles: req.user?.roles || [],
      organization: req.user?.organizationId || '',
      projectId: req.project?.id || '',
      environment: req.project?.environment || 'development',
      ipAddress: req.ip,
      deviceId: req.headers['x-device-id'] as string,
      lastAuthenticated: req.user?.lastAuthenticated
        ? new Date(req.user.lastAuthenticated)
        : undefined,
      customAttributes: req.user?.attributes || {}
    };
  }

  /**
   * Build resource attributes from request
   */
  private buildResourceAttributes(req: Request): ResourceAttributes {
    return {
      type: req.baseUrl.split('/')[1] || '',
      id: req.params.id || '',
      owner: req.params.owner || req.user?.id || '',
      projectId: req.project?.id || '',
      organization: req.project?.organizationId || '',
      environment: req.project?.environment || 'development',
      tags: req.resource?.tags || [],
      sensitivity: req.resource?.sensitivity || 'internal',
      customAttributes: req.resource?.attributes || {}
    };
  }

  /**
   * Build environment attributes from request
   */
  private buildEnvironmentAttributes(req: Request): EnvironmentAttributes {
    const now = new Date();
    return {
      timestamp: now,
      timeOfDay: now.getHours(),
      dayOfWeek: now.getDay(),
      ipRange: req.headers['x-forwarded-for'] as string || req.ip,
      location: req.headers['x-geo-location'] as string,
      customAttributes: {}
    };
  }

  /**
   * Check access for a specific permission
   */
  public checkPermission(permission: Permission) {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        // Build access request
        const accessRequest: AccessRequest = {
          subject: this.buildSubjectAttributes(req),
          resource: this.buildResourceAttributes(req),
          action: permission,
          environment: this.buildEnvironmentAttributes(req),
          context: {
            method: req.method,
            path: req.path,
            query: req.query,
            headers: req.headers
          }
        };

        // Check access
        const response = await this.policyEngine.checkAccess(accessRequest);

        // Log access attempt
        logger.info('Access control check', {
          userId: req.user?.id,
          permission,
          allowed: response.allowed,
          reason: response.reason,
          requestId: response.auditLog?.requestId
        });

        if (!response.allowed) {
          return res.status(403).json({
            error: 'Access denied',
            reason: response.reason,
            requestId: response.auditLog?.requestId
          });
        }

        // Attach access response to request for downstream use
        req.accessControl = {
          response,
          permission
        };

        next();
      } catch (error) {
        logger.error('Access control check failed', {
          error,
          userId: req.user?.id,
          permission
        });

        return res.status(500).json({
          error: 'Failed to check access permissions',
          requestId: crypto.randomUUID()
        });
      }
    };
  }

  /**
   * Check multiple permissions (any)
   */
  public checkAnyPermission(permissions: Permission[]) {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const accessRequests: AccessRequest[] = permissions.map(permission => ({
          subject: this.buildSubjectAttributes(req),
          resource: this.buildResourceAttributes(req),
          action: permission,
          environment: this.buildEnvironmentAttributes(req),
          context: {
            method: req.method,
            path: req.path,
            query: req.query,
            headers: req.headers
          }
        }));

        // Check each permission
        const responses = await Promise.all(
          accessRequests.map(request => this.policyEngine.checkAccess(request))
        );

        // If any permission is allowed, grant access
        const allowedResponse = responses.find(response => response.allowed);

        if (allowedResponse) {
          // Attach access response to request for downstream use
          req.accessControl = {
            response: allowedResponse,
            permissions
          };

          next();
        } else {
          return res.status(403).json({
            error: 'Access denied',
            reason: 'None of the required permissions are granted',
            requestId: crypto.randomUUID()
          });
        }
      } catch (error) {
        logger.error('Access control check failed', {
          error,
          userId: req.user?.id,
          permissions
        });

        return res.status(500).json({
          error: 'Failed to check access permissions',
          requestId: crypto.randomUUID()
        });
      }
    };
  }

  /**
   * Check multiple permissions (all)
   */
  public checkAllPermissions(permissions: Permission[]) {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const accessRequests: AccessRequest[] = permissions.map(permission => ({
          subject: this.buildSubjectAttributes(req),
          resource: this.buildResourceAttributes(req),
          action: permission,
          environment: this.buildEnvironmentAttributes(req),
          context: {
            method: req.method,
            path: req.path,
            query: req.query,
            headers: req.headers
          }
        }));

        // Check each permission
        const responses = await Promise.all(
          accessRequests.map(request => this.policyEngine.checkAccess(request))
        );

        // All permissions must be allowed
        const allAllowed = responses.every(response => response.allowed);

        if (allAllowed) {
          // Attach access responses to request for downstream use
          req.accessControl = {
            responses,
            permissions
          };

          next();
        } else {
          const deniedPermissions = responses
            .map((response, index) => ({
              permission: permissions[index],
              response
            }))
            .filter(item => !item.response.allowed);

          return res.status(403).json({
            error: 'Access denied',
            reason: 'Missing required permissions',
            deniedPermissions: deniedPermissions.map(item => ({
              permission: item.permission,
              reason: item.response.reason
            })),
            requestId: crypto.randomUUID()
          });
        }
      } catch (error) {
        logger.error('Access control check failed', {
          error,
          userId: req.user?.id,
          permissions
        });

        return res.status(500).json({
          error: 'Failed to check access permissions',
          requestId: crypto.randomUUID()
        });
      }
    };
  }
} 