import { Router, Request, Response, NextFunction } from 'express';
import { ProjectService } from '../services/project/projectService';
import { OrganizationService } from '../services/project/organizationService';
import { ApiKeyService } from '../services/project/apiKeyService';
import { ProjectType, ProjectStatus } from '../types/project';
import { NotFoundError, ValidationError } from '../utils/errors';
import { Pool } from 'pg';

const pool = new Pool();
const defaultProjectService = new ProjectService(pool);
const defaultOrganizationService = new OrganizationService(pool);
const defaultApiKeyService = new ApiKeyService(pool);

export const createHandlers = (
  projectService: ProjectService = defaultProjectService,
  organizationService: OrganizationService = defaultOrganizationService,
  apiKeyService: ApiKeyService = defaultApiKeyService
) => ({
  createProject: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, organizationId, type } = req.body;

      if (!name || !organizationId || !type) {
        res.status(400).json({ error: 'Missing required fields' });
        return;
      }

      const project = await projectService.createProject(
        name,
        organizationId,
        type as ProjectType
      );

      res.status(201).json(project);
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else {
        next(error);
      }
    }
  },

  getProject: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      if (!id) {
        res.status(400).json({ error: 'Project ID is required' });
        return;
      }

      const project = await projectService.getProject(id);
      res.status(200).json(project);
    } catch (error) {
      if (error instanceof NotFoundError) {
        res.status(404).json({ error: error.message });
        return;
      }
      next(error);
    }
  },

  updateProject: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      if (!id) {
        res.status(400).json({ error: 'Project ID is required' });
        return;
      }

      const project = await projectService.updateProject(id, req.body);
      res.status(200).json(project);
    } catch (error) {
      if (error instanceof NotFoundError) {
        res.status(404).json({ error: error.message });
        return;
      }
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
        return;
      }
      next(error);
    }
  },

  getOrganizationProjects: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      if (!id) {
        res.status(400).json({ error: 'Organization ID is required' });
        return;
      }

      const projects = await projectService.getProjectsByOrganization(id);
      res.status(200).json(projects);
    } catch (error) {
      if (error instanceof NotFoundError) {
        res.status(404).json({ error: error.message });
        return;
      }
      next(error);
    }
  },

  createApiKey: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { name, type, permissions } = req.body;
      const userId = req.user?.id;

      if (!id || !name || !userId) {
        res.status(400).json({ error: 'Missing required fields' });
        return;
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
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
        return;
      }
      if (error instanceof NotFoundError) {
        res.status(404).json({ error: error.message });
        return;
      }
      next(error);
    }
  },

  getProjectApiKeys: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      if (!id) {
        res.status(400).json({ error: 'Project ID is required' });
        return;
      }

      const apiKeys = await apiKeyService.getProjectApiKeys(id);
      res.status(200).json(apiKeys);
    } catch (error) {
      if (error instanceof NotFoundError) {
        res.status(404).json({ error: error.message });
        return;
      }
      next(error);
    }
  },

  updateProjectSettings: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      if (!id) {
        res.status(400).json({ error: 'Project ID is required' });
        return;
      }

      const settings = await projectService.updateProjectSettings(id, req.body);
      res.status(200).json(settings);
    } catch (error) {
      if (error instanceof NotFoundError) {
        res.status(404).json({ error: error.message });
        return;
      }
      next(error);
    }
  },

  revokeApiKey: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { keyId } = req.params;
      if (!keyId) {
        res.status(400).json({ error: 'API Key ID is required' });
        return;
      }

      const apiKey = await apiKeyService.revokeApiKey(keyId);
      res.status(200).json(apiKey);
    } catch (error) {
      if (error instanceof NotFoundError) {
        res.status(404).json({ error: error.message });
        return;
      }
      next(error);
    }
  }
});

const defaultHandlers = createHandlers();

// Routes
const router = Router();
router.post('/', defaultHandlers.createProject);
router.get('/:id', defaultHandlers.getProject);
router.put('/:id', defaultHandlers.updateProject);
router.get('/organizations/:id/projects', defaultHandlers.getOrganizationProjects);
router.post('/:id/api-keys', defaultHandlers.createApiKey);
router.get('/:id/api-keys', defaultHandlers.getProjectApiKeys);
router.put('/:id/settings', defaultHandlers.updateProjectSettings);
router.delete('/:projectId/api-keys/:keyId', defaultHandlers.revokeApiKey);

export { router as projectRouter }; 