import { Request, Response, NextFunction } from 'express';
import { ApiKeyService } from '../services/project/apiKeyService';
import { ProjectService } from '../services/project/projectService';
import { UnauthorizedError } from '../utils/errors';

// Extend Express Request type to include project context
declare global {
  namespace Express {
    interface Request {
      project?: {
        id: string;
        organizationId: string;
        environment: string;
        apiKey?: {
          id: string;
          type: string;
          permissions: string[];
        };
      };
    }
  }
}

export class ProjectAuthMiddleware {
  private apiKeyService: ApiKeyService;
  private projectService: ProjectService;

  constructor(apiKeyService: ApiKeyService, projectService: ProjectService) {
    this.apiKeyService = apiKeyService;
    this.projectService = projectService;
  }

  /**
   * Middleware to authenticate API key and set project context
   */
  requireApiKey = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const apiKey = this.extractApiKey(req);
      if (!apiKey) {
        throw new UnauthorizedError('API key is required');
      }

      // Validate API key and get details
      const apiKeyDetails = await this.apiKeyService.validateApiKey(apiKey);

      // Get project details
      const project = await this.projectService.getProject(apiKeyDetails.projectId);

      // Set project context
      req.project = {
        id: project.id,
        organizationId: project.organizationId,
        environment: project.environment,
        apiKey: {
          id: apiKeyDetails.id,
          type: apiKeyDetails.type,
          permissions: apiKeyDetails.permissions
        }
      };

      next();
    } catch (error) {
      next(error);
    }
  };

  /**
   * Middleware to require specific API key permissions
   */
  requirePermissions = (requiredPermissions: string[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!req.project?.apiKey) {
        throw new UnauthorizedError('API key context not found');
      }

      const hasAllPermissions = requiredPermissions.every(permission =>
        req.project.apiKey.permissions.includes(permission)
      );

      if (!hasAllPermissions) {
        throw new UnauthorizedError('Insufficient permissions');
      }

      next();
    };
  };

  /**
   * Middleware to require specific API key type
   */
  requireKeyType = (allowedTypes: string[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!req.project?.apiKey) {
        throw new UnauthorizedError('API key context not found');
      }

      if (!allowedTypes.includes(req.project.apiKey.type)) {
        throw new UnauthorizedError('Invalid API key type');
      }

      next();
    };
  };

  /**
   * Extract API key from request
   */
  private extractApiKey(req: Request): string | undefined {
    // Try Authorization header first
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    // Try X-API-Key header next
    const apiKeyHeader = req.headers['x-api-key'];
    if (apiKeyHeader) {
      return Array.isArray(apiKeyHeader) ? apiKeyHeader[0] : apiKeyHeader;
    }

    // Finally, try query parameter
    return req.query.api_key as string | undefined;
  }
} 