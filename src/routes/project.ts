import { Router, Request, Response, NextFunction } from 'express';
import { ProjectService } from '../services/project/projectService';
import { OrganizationService } from '../services/project/organizationService';
import { ApiKeyService } from '../services/project/apiKeyService';
import { ProjectType, ProjectStatus } from '../types/project';
import { NotFoundError, ValidationError } from '../utils/errors';
import { Pool } from 'pg';

const router = Router();

const pool = new Pool();
const projectService = new ProjectService(pool);
const organizationService = new OrganizationService(pool);
const apiKeyService = new ApiKeyService(pool);

// Create project
router.post(
  '/',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, organizationId, type } = req.body;

      if (!name || !organizationId || !type) {
        throw new ValidationError('Missing required fields');
      }

      const project = await projectService.createProject(
        name,
        organizationId,
        type as ProjectType
      );

      res.status(201).json(project);
    } catch (error) {
      next(error);
    }
  }
);

// Get project by ID
router.get(
  '/:id',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      if (!id) {
        throw new ValidationError('Project ID is required');
      }

      const project = await projectService.getProject(id);
      res.json(project);
    } catch (error) {
      next(error);
    }
  }
);

// Update project
router.put(
  '/:id',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      if (!id) {
        throw new ValidationError('Project ID is required');
      }

      const project = await projectService.updateProject(id, req.body);
      res.json(project);
    } catch (error) {
      next(error);
    }
  }
);

// Get organization projects
router.get(
  '/organizations/:id/projects',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      if (!id) {
        throw new ValidationError('Organization ID is required');
      }

      const projects = await projectService.getProjectsByOrganization(id);
      res.json(projects);
    } catch (error) {
      next(error);
    }
  }
);

// Create API key
router.post(
  '/:id/api-keys',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { name, type, permissions } = req.body;
      const userId = req.user?.id;

      if (!id || !name || !userId) {
        throw new ValidationError('Missing required fields');
      }

      const apiKey = await apiKeyService.createApiKey(
        id,
        name,
        type,
        permissions,
        userId
      );

      res.status(201).json(apiKey);
    } catch (error) {
      next(error);
    }
  }
);

// Get project API keys
router.get(
  '/:id/api-keys',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      if (!id) {
        throw new ValidationError('Project ID is required');
      }

      const apiKeys = await apiKeyService.getProjectApiKeys(id);
      res.json(apiKeys);
    } catch (error) {
      next(error);
    }
  }
);

// Update project settings
router.put(
  '/:id/settings',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      if (!id) {
        throw new ValidationError('Project ID is required');
      }

      const settings = await projectService.updateProjectSettings(id, req.body);
      res.json(settings);
    } catch (error) {
      next(error);
    }
  }
);

// Revoke API key
router.delete(
  '/:projectId/api-keys/:keyId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { keyId } = req.params;
      if (!keyId) {
        throw new ValidationError('API Key ID is required');
      }

      const apiKey = await apiKeyService.revokeApiKey(keyId);
      res.json(apiKey);
    } catch (error) {
      next(error);
    }
  }
);

export { router as projectRouter }; 