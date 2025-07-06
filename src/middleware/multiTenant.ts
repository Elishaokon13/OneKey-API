import { Request, Response, NextFunction } from 'express';
import { ProjectService } from '../services/project/projectService';
import { NotFoundError, ValidationError, AuthorizationError } from '../utils/errors';
import rateLimit from 'express-rate-limit';
import { Pool } from 'pg';
import { Project } from '../types/project';

// Extend Express Request to include project context
declare global {
  namespace Express {
    interface Request {
      project?: Project;
    }
  }
}

export class MultiTenantMiddleware {
  private projectService: ProjectService;
  private rateLimiters: Map<string, ReturnType<typeof rateLimit>>;

  constructor(pool: Pool) {
    this.projectService = new ProjectService(pool);
    this.rateLimiters = new Map();
  }

  /**
   * Middleware to validate and attach project context to the request
   */
  projectContext = async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Get project ID from header or query param
      const projectId = req.header('x-project-id') || req.query.projectId as string;

      if (!projectId) {
        throw new ValidationError('Project ID is required');
      }

      // Get project from database
      const project = await this.projectService.getProject(projectId);

      // Validate project status
      if (project.status !== 'active') {
        throw new AuthorizationError('Project is not active');
      }

      // Attach project to request
      req.project = project;

      next();
    } catch (error) {
      if (error instanceof NotFoundError) {
        res.status(404).json({ error: 'Project not found' });
      } else if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else if (error instanceof AuthorizationError) {
        res.status(403).json({ error: error.message });
      } else {
        next(error);
      }
    }
  };

  /**
   * Middleware to enforce resource isolation between projects
   */
  resourceIsolation = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const resourceProjectId = req.params?.projectId || req.body?.projectId;
      
      if (!req.project) {
        throw new ValidationError('Project context is required');
      }

      if (resourceProjectId && resourceProjectId !== req.project.id) {
        throw new AuthorizationError('Access denied to resource from different project');
      }

      next();
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else if (error instanceof AuthorizationError) {
        res.status(403).json({ error: error.message });
      } else {
        next(error);
      }
    }
  };

  /**
   * Get or create a rate limiter for a specific project
   */
  private getRateLimiter(projectId: string) {
    if (!this.rateLimiters.has(projectId)) {
      this.rateLimiters.set(projectId, rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: async (req) => {
          // Get project's rate limit from metadata or use default
          const project = await this.projectService.getProject(projectId);
          return project.metadata?.rateLimit || 100;
        },
        keyGenerator: (req) => `${projectId}:${req.ip}`,
        handler: (req, res) => {
          res.status(429).json({
            error: 'Too many requests',
            retryAfter: res.getHeader('Retry-After')
          });
        }
      }));
    }
    return this.rateLimiters.get(projectId)!;
  }

  /**
   * Middleware to apply rate limiting per project
   */
  rateLimiting = (req: Request, res: Response, next: NextFunction) => {
    if (!req.project) {
      return res.status(400).json({ error: 'Project context is required' });
    }

    const rateLimiter = this.getRateLimiter(req.project.id);
    return rateLimiter(req, res, next);
  };
} 