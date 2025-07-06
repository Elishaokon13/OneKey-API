import express from 'express';
import { body, param } from 'express-validator';
import { ProjectService } from '../services/project/projectService';
import { OrganizationService } from '../services/project/organizationService';
import { ApiKeyService } from '../services/project/apiKeyService';
import { validateRequest } from '../middleware/validation';
import { ProjectType, ApiKeyType } from '../types/project';

const router = express.Router();
const projectService = new ProjectService();
const organizationService = new OrganizationService();
const apiKeyService = new ApiKeyService();

// Create project
router.post('/',
  [
    body('name').isString().trim().notEmpty(),
    body('organizationId').isString().notEmpty(),
    body('type').isIn(Object.values(ProjectType)),
    body('metadata').optional().isObject()
  ],
  validateRequest,
  async (req, res, next) => {
    try {
      const project = await projectService.createProject(
        req.body.name,
        req.body.organizationId,
        req.body.type,
        req.body.metadata
      );
      res.status(201).json(project);
    } catch (error) {
      next(error);
    }
  }
);

// Get project by ID
router.get('/:id',
  [param('id').isString().notEmpty()],
  validateRequest,
  async (req, res, next) => {
    try {
      const project = await projectService.getProject(req.params.id);
      res.json(project);
    } catch (error) {
      next(error);
    }
  }
);

// Update project
router.put('/:id',
  [
    param('id').isString().notEmpty(),
    body('name').optional().isString().trim().notEmpty(),
    body('metadata').optional().isObject()
  ],
  validateRequest,
  async (req, res, next) => {
    try {
      const project = await projectService.updateProject(req.params.id, req.body);
      res.json(project);
    } catch (error) {
      next(error);
    }
  }
);

// Get organization projects
router.get('/organizations/:id/projects',
  [param('id').isString().notEmpty()],
  validateRequest,
  async (req, res, next) => {
    try {
      const projects = await projectService.getProjectsByOrganization(req.params.id);
      res.json(projects);
    } catch (error) {
      next(error);
    }
  }
);

// Create API key
router.post('/:id/api-keys',
  [
    param('id').isString().notEmpty(),
    body('name').isString().trim().notEmpty(),
    body('type').optional().isIn(Object.values(ApiKeyType)).default(ApiKeyType.Secret),
    body('permissions').optional().isArray(),
    body('expiresAt').optional().isISO8601(),
    body('metadata').optional().isObject()
  ],
  validateRequest,
  async (req, res, next) => {
    try {
      const apiKey = await apiKeyService.createApiKey(
        req.params.id,
        req.body.name,
        req.body.type,
        req.body.permissions || [],
        req.user.id,
        req.body.expiresAt,
        req.body.metadata
      );
      res.status(201).json(apiKey);
    } catch (error) {
      next(error);
    }
  }
);

// Get project API keys
router.get('/:id/api-keys',
  [param('id').isString().notEmpty()],
  validateRequest,
  async (req, res, next) => {
    try {
      const apiKeys = await apiKeyService.getProjectApiKeys(req.params.id);
      res.json(apiKeys);
    } catch (error) {
      next(error);
    }
  }
);

// Revoke API key
router.delete('/:projectId/api-keys/:keyId',
  [
    param('projectId').isString().notEmpty(),
    param('keyId').isString().notEmpty()
  ],
  validateRequest,
  async (req, res, next) => {
    try {
      const apiKey = await apiKeyService.revokeApiKey(req.params.keyId);
      res.json(apiKey);
    } catch (error) {
      next(error);
    }
  }
);

// Update project settings
router.put('/:id/settings',
  [
    param('id').isString().notEmpty(),
    body('webhookUrl').optional().isURL(),
    body('allowedOrigins').optional().isArray(),
    body('customSettings').optional().isObject()
  ],
  validateRequest,
  async (req, res, next) => {
    try {
      const settings = await projectService.updateProjectSettings(
        req.params.id,
        req.body
      );
      res.json(settings);
    } catch (error) {
      next(error);
    }
  }
);

export { router as projectRouter }; 