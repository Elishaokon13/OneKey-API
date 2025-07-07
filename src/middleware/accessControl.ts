// OneKey KYC API - Access Control Middleware

import { Request, Response, NextFunction } from 'express';
import { AccessControlService } from '../services/auth/accessControlService';
import { AccessLevel, Permission } from '../types/accessControl';
import { logger as Logger } from '../utils/logger';
import { AccessControlError } from '../utils/errors';

export class AccessControlMiddleware {
  private static instance: AccessControlMiddleware;
  private accessControlService: AccessControlService;

  private constructor(accessControlService: AccessControlService) {
    this.accessControlService = accessControlService;
  }

  public static getInstance(accessControlService: AccessControlService): AccessControlMiddleware {
    if (!AccessControlMiddleware.instance) {
      AccessControlMiddleware.instance = new AccessControlMiddleware(accessControlService);
    }
    return AccessControlMiddleware.instance;
  }

  public checkPermission(permission: Permission) {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = req.user?.id;
        const projectId = req.params.projectId || req.body.projectId;

        if (!userId || !projectId) {
          throw new AccessControlError('Missing user ID or project ID');
        }

        const hasAccess = await this.accessControlService.checkAccess(
          userId,
          projectId,
          AccessLevel.USER
        );

        if (!hasAccess) {
          throw new AccessControlError('Access denied');
        }

        next();
      } catch (error) {
        Logger.error('Access control middleware error', { error });
        if (error instanceof AccessControlError) {
          res.status(403).json({ error: error.message });
        } else {
          res.status(500).json({ error: 'Internal server error' });
        }
      }
    };
  }

  public checkAnyPermission(permissions: Permission[]) {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = req.user?.id;
        const projectId = req.params.projectId || req.body.projectId;

        if (!userId || !projectId) {
          throw new AccessControlError('Missing user ID or project ID');
        }

        const hasAccess = await this.accessControlService.checkAccess(
          userId,
          projectId,
          AccessLevel.USER
        );

        if (!hasAccess) {
          throw new AccessControlError('Access denied');
        }

        next();
      } catch (error) {
        Logger.error('Access control middleware error', { error });
        if (error instanceof AccessControlError) {
          res.status(403).json({ error: error.message });
        } else {
          res.status(500).json({ error: 'Internal server error' });
        }
      }
    };
  }

  public checkAllPermissions(permissions: Permission[]) {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = req.user?.id;
        const projectId = req.params.projectId || req.body.projectId;

        if (!userId || !projectId) {
          throw new AccessControlError('Missing user ID or project ID');
        }

        const hasAccess = await this.accessControlService.checkAccess(
          userId,
          projectId,
          AccessLevel.ADMIN
        );

        if (!hasAccess) {
          throw new AccessControlError('Access denied');
        }

        next();
      } catch (error) {
        Logger.error('Access control middleware error', { error });
        if (error instanceof AccessControlError) {
          res.status(403).json({ error: error.message });
        } else {
          res.status(500).json({ error: 'Internal server error' });
        }
      }
    };
  }

  public requireEnvironment(environment: string) {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const currentEnv = process.env.NODE_ENV || 'development';
        if (currentEnv !== environment) {
          throw new AccessControlError(`This endpoint is only available in ${environment} environment`);
        }
        next();
      } catch (error) {
        Logger.error('Environment check failed', { error });
        if (error instanceof AccessControlError) {
          res.status(403).json({ error: error.message });
        } else {
          res.status(500).json({ error: 'Internal server error' });
        }
      }
    };
  }
}

export const requirePermission = (permission: Permission) => {
  const middleware = AccessControlMiddleware.getInstance(AccessControlService.getInstance());
  return middleware.checkPermission(permission);
};

export const requireEnvironment = (environment: string) => {
  const middleware = AccessControlMiddleware.getInstance(AccessControlService.getInstance());
  return middleware.requireEnvironment(environment);
}; 