// OneKey KYC API - Access Control Middleware

import { Request, Response, NextFunction } from 'express';
import { AccessControlService } from '../services/auth/accessControlService';

export const requirePermission = (permission: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      const projectId = req.project?.id;

      if (!userId || !projectId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const accessControlService = new AccessControlService();
      const hasPermission = await accessControlService.hasPermission(
        userId,
        projectId,
        permission
      );

      if (!hasPermission) {
        await accessControlService.logAccessAttempt(
          userId,
          projectId,
          permission,
          false,
          { path: req.path, method: req.method }
        );
        return res.status(403).json({ error: 'Forbidden' });
      }

      await accessControlService.logAccessAttempt(
        userId,
        projectId,
        permission,
        true,
        { path: req.path, method: req.method }
      );

      next();
    } catch (error) {
      next(error);
    }
  };
};

export const requireEnvironment = (environment: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      const projectId = req.project?.id;

      if (!userId || !projectId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const accessControlService = new AccessControlService();
      const allowed = await accessControlService.evaluateABACRules(
        userId,
        projectId,
        { environment }
      );

      if (!allowed) {
        await accessControlService.logAccessAttempt(
          userId,
          projectId,
          `${environment}:access`,
          false,
          { path: req.path, method: req.method }
        );
        return res.status(403).json({ error: 'Forbidden' });
      }

      await accessControlService.logAccessAttempt(
        userId,
        projectId,
        `${environment}:access`,
        true,
        { path: req.path, method: req.method }
      );

      next();
    } catch (error) {
      next(error);
    }
  };
}; 