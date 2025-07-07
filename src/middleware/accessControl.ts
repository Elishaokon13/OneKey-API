// OneKey KYC API - Access Control Middleware

import { Request, Response, NextFunction } from 'express';
import { AccessControlService } from '../services/auth/accessControlService';
import { Permission } from '../types/access-control';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    project_id?: string;
  };
}

export const requirePermission = (permission: Permission) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const projectId = req.params.projectId || user.project_id;
    if (!projectId) {
      return res.status(400).json({ error: 'Project ID is required' });
    }

    const accessControlService = new AccessControlService(req.app.locals.db);

    try {
      const hasPermission = await accessControlService.hasPermission(
        user.id,
        projectId,
        permission
      );

      if (!hasPermission) {
        await accessControlService.logAccessAttempt(
          user.id,
          projectId,
          permission,
          false,
          { path: req.path, method: req.method }
        );
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      await accessControlService.logAccessAttempt(
        user.id,
        projectId,
        permission,
        true,
        { path: req.path, method: req.method }
      );

      next();
    } catch (error) {
      console.error('Access control error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
};

export const requireContext = (contextValidator: (context: Record<string, any>) => Record<string, any>) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const projectId = req.params.projectId || user.project_id;
    if (!projectId) {
      return res.status(400).json({ error: 'Project ID is required' });
    }

    try {
      // Build context from request
      const context = contextValidator({
        path: req.path,
        method: req.method,
        query: req.query,
        body: req.body,
        params: req.params,
        headers: req.headers,
      });

      const accessControlService = new AccessControlService(req.app.locals.db);
      
      const allowed = await accessControlService.evaluateABACRules(
        user.id,
        projectId,
        context
      );

      if (!allowed) {
        await accessControlService.logAccessAttempt(
          user.id,
          projectId,
          'abac:evaluate',
          false,
          context
        );
        return res.status(403).json({ error: 'Access denied by ABAC rules' });
      }

      await accessControlService.logAccessAttempt(
        user.id,
        projectId,
        'abac:evaluate',
        true,
        context
      );

      // Add validated context to request for route handlers
      req.abacContext = context;
      next();
    } catch (error) {
      console.error('ABAC evaluation error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}; 