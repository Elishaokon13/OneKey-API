import { Router } from 'express';
import { OrganizationService } from '../services/project/organizationService';
import { ProjectService } from '../services/project/projectService';
import { ApiKeyService } from '../services/project/apiKeyService';
import { ProjectAuthMiddleware } from '../middleware/projectAuth';
import { validateRequest } from '../middleware/validation';
import { organizationSchema, projectSchema, projectApiKeySchema } from '../types/project';
import { ValidationError } from '../utils/errors';

export function createProjectRouter(
  organizationService: OrganizationService,
  projectService: ProjectService,
  apiKeyService: ApiKeyService,
  projectAuth: ProjectAuthMiddleware
) {
  const router = Router();

  // Organization routes
  router.post('/organizations', validateRequest({ body: organizationSchema }), async (req, res, next) => {
    try {
      const { name, billingEmail } = req.body;
      const organization = await organizationService.createOrganization(
        name,
        billingEmail,
        req.user.id
      );
      res.status(201).json(organization);
    } catch (error) {
      next(error);
    }
  });

  router.get('/organizations/:id', async (req, res, next) => {
    try {
      const organization = await organizationService.getOrganization(req.params.id);
      res.json(organization);
    } catch (error) {
      next(error);
    }
  });

  router.patch('/organizations/:id', validateRequest({ body: organizationSchema.partial() }), async (req, res, next) => {
    try {
      const organization = await organizationService.updateOrganization(
        req.params.id,
        req.body
      );
      res.json(organization);
    } catch (error) {
      next(error);
    }
  });

  router.delete('/organizations/:id', async (req, res, next) => {
    try {
      await organizationService.deleteOrganization(req.params.id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  // Organization members routes
  router.post('/organizations/:id/members', async (req, res, next) => {
    try {
      const { userId, role } = req.body;
      const member = await organizationService.addMember(
        req.params.id,
        userId,
        role,
        req.user.id
      );
      res.status(201).json(member);
    } catch (error) {
      next(error);
    }
  });

  router.get('/organizations/:id/members', async (req, res, next) => {
    try {
      const members = await organizationService.getMembers(req.params.id);
      res.json(members);
    } catch (error) {
      next(error);
    }
  });

  router.patch('/organizations/:id/members/:userId', async (req, res, next) => {
    try {
      const { role } = req.body;
      const member = await organizationService.updateMemberRole(
        req.params.id,
        req.params.userId,
        role
      );
      res.json(member);
    } catch (error) {
      next(error);
    }
  });

  router.delete('/organizations/:id/members/:userId', async (req, res, next) => {
    try {
      await organizationService.removeMember(req.params.id, req.params.userId);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  // Project routes
  router.post('/organizations/:id/projects', validateRequest({ body: projectSchema }), async (req, res, next) => {
    try {
      const { name, environment, kycProviders } = req.body;
      const project = await projectService.createProject(
        req.params.id,
        name,
        environment,
        kycProviders
      );
      res.status(201).json(project);
    } catch (error) {
      next(error);
    }
  });

  router.get('/organizations/:id/projects', async (req, res, next) => {
    try {
      const projects = await projectService.getOrganizationProjects(req.params.id);
      res.json(projects);
    } catch (error) {
      next(error);
    }
  });

  router.get('/projects/:id', async (req, res, next) => {
    try {
      const project = await projectService.getProject(req.params.id);
      res.json(project);
    } catch (error) {
      next(error);
    }
  });

  router.patch('/projects/:id', validateRequest({ body: projectSchema.partial() }), async (req, res, next) => {
    try {
      const project = await projectService.updateProject(
        req.params.id,
        req.body
      );
      res.json(project);
    } catch (error) {
      next(error);
    }
  });

  router.delete('/projects/:id', async (req, res, next) => {
    try {
      await projectService.deleteProject(req.params.id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  // Project settings routes
  router.get('/projects/:id/settings', async (req, res, next) => {
    try {
      const settings = await projectService.getProjectSettings(req.params.id);
      res.json(settings);
    } catch (error) {
      next(error);
    }
  });

  router.get('/projects/:id/settings/:key', async (req, res, next) => {
    try {
      const setting = await projectService.getProjectSetting(req.params.id, req.params.key);
      res.json(setting);
    } catch (error) {
      next(error);
    }
  });

  router.put('/projects/:id/settings/:key', async (req, res, next) => {
    try {
      const { value } = req.body;
      if (value === undefined) {
        throw new ValidationError('Setting value is required');
      }
      const setting = await projectService.updateProjectSetting(
        req.params.id,
        req.params.key,
        value
      );
      res.json(setting);
    } catch (error) {
      next(error);
    }
  });

  router.delete('/projects/:id/settings/:key', async (req, res, next) => {
    try {
      await projectService.deleteProjectSetting(req.params.id, req.params.key);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  // API key routes
  router.post('/projects/:id/api-keys', validateRequest({ body: projectApiKeySchema }), async (req, res, next) => {
    try {
      const { name, type, permissions, expiresAt, rateLimitOverride } = req.body;
      const { apiKey, apiKeyDetails } = await apiKeyService.createApiKey(
        req.params.id,
        name,
        type,
        permissions,
        req.user.id,
        expiresAt,
        rateLimitOverride
      );
      res.status(201).json({ apiKey, ...apiKeyDetails });
    } catch (error) {
      next(error);
    }
  });

  router.get('/projects/:id/api-keys', async (req, res, next) => {
    try {
      const apiKeys = await apiKeyService.getProjectApiKeys(req.params.id);
      res.json(apiKeys);
    } catch (error) {
      next(error);
    }
  });

  router.get('/projects/:id/api-keys/:keyId', async (req, res, next) => {
    try {
      const apiKey = await apiKeyService.getApiKey(req.params.keyId);
      res.json(apiKey);
    } catch (error) {
      next(error);
    }
  });

  router.patch('/projects/:id/api-keys/:keyId', async (req, res, next) => {
    try {
      const apiKey = await apiKeyService.updateApiKey(
        req.params.keyId,
        req.body
      );
      res.json(apiKey);
    } catch (error) {
      next(error);
    }
  });

  router.delete('/projects/:id/api-keys/:keyId', async (req, res, next) => {
    try {
      await apiKeyService.deleteApiKey(req.params.keyId);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  return router;
} 