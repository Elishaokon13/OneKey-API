import request from 'supertest';
import express from 'express';
import { ProjectService } from '../../services/project/projectService';
import { OrganizationService } from '../../services/project/organizationService';
import { ApiKeyService } from '../../services/project/apiKeyService';
import { projectRouter } from '../../routes/project';
import { ProjectType, ProjectStatus, ApiKeyStatus } from '../../types/project';
import { NotFoundError } from '../../utils/errors';

// Mock services
jest.mock('../../services/project/projectService');
jest.mock('../../services/project/organizationService');
jest.mock('../../services/project/apiKeyService');

describe('Project Routes', () => {
  let app: express.Application;
  const mockProjectService = ProjectService as jest.Mocked<typeof ProjectService>;
  const mockOrganizationService = OrganizationService as jest.Mocked<typeof OrganizationService>;
  const mockApiKeyService = ApiKeyService as jest.Mocked<typeof ApiKeyService>;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/projects', projectRouter);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/projects', () => {
    it('should create a new project', async () => {
      const testProject = {
        id: '123',
        name: 'Test Project',
        organizationId: 'org123',
        type: ProjectType.Production,
        status: ProjectStatus.Active
      };

      mockProjectService.prototype.createProject.mockResolvedValueOnce(testProject);

      const response = await request(app)
        .post('/api/projects')
        .send({
          name: 'Test Project',
          organizationId: 'org123',
          type: ProjectType.Production
        });

      expect(response.status).toBe(201);
      expect(response.body).toEqual(testProject);
    });

    it('should return 400 for invalid input', async () => {
      const response = await request(app)
        .post('/api/projects')
        .send({
          name: '', // Invalid: empty name
          organizationId: 'org123',
          type: 'invalid_type' // Invalid: wrong enum value
        });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/projects/:id', () => {
    it('should return project by id', async () => {
      const testProject = {
        id: '123',
        name: 'Test Project',
        status: ProjectStatus.Active
      };

      mockProjectService.prototype.getProject.mockResolvedValueOnce(testProject);

      const response = await request(app)
        .get('/api/projects/123');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(testProject);
    });

    it('should return 404 for non-existent project', async () => {
      mockProjectService.prototype.getProject.mockRejectedValueOnce(
        new NotFoundError('Project not found')
      );

      const response = await request(app)
        .get('/api/projects/999');

      expect(response.status).toBe(404);
    });
  });

  describe('PUT /api/projects/:id', () => {
    it('should update project', async () => {
      const updates = {
        name: 'Updated Project',
        metadata: { key: 'value' }
      };

      const updatedProject = {
        id: '123',
        ...updates,
        status: ProjectStatus.Active
      };

      mockProjectService.prototype.updateProject.mockResolvedValueOnce(updatedProject);

      const response = await request(app)
        .put('/api/projects/123')
        .send(updates);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(updatedProject);
    });

    it('should return 404 for non-existent project', async () => {
      mockProjectService.prototype.updateProject.mockRejectedValueOnce(
        new NotFoundError('Project not found')
      );

      const response = await request(app)
        .put('/api/projects/999')
        .send({ name: 'Updated Project' });

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/organizations/:id/projects', () => {
    it('should return organization projects', async () => {
      const testProjects = [
        { id: '123', name: 'Project 1', type: ProjectType.Production },
        { id: '456', name: 'Project 2', type: ProjectType.Sandbox }
      ];

      mockProjectService.prototype.getProjectsByOrganization.mockResolvedValueOnce(testProjects);

      const response = await request(app)
        .get('/api/organizations/org123/projects');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(testProjects);
    });
  });

  describe('POST /api/projects/:id/api-keys', () => {
    it('should create API key', async () => {
      const testApiKey = {
        id: '123',
        projectId: 'proj123',
        name: 'Test Key',
        key: 'pk_test_123',
        status: ApiKeyStatus.Active
      };

      mockApiKeyService.prototype.createApiKey.mockResolvedValueOnce(testApiKey);

      const response = await request(app)
        .post('/api/projects/proj123/api-keys')
        .send({ name: 'Test Key' });

      expect(response.status).toBe(201);
      expect(response.body).toEqual(testApiKey);
    });
  });

  describe('GET /api/projects/:id/api-keys', () => {
    it('should return project API keys', async () => {
      const testApiKeys = [
        { id: '123', name: 'Key 1', status: ApiKeyStatus.Active },
        { id: '456', name: 'Key 2', status: ApiKeyStatus.Revoked }
      ];

      mockApiKeyService.prototype.getProjectApiKeys.mockResolvedValueOnce(testApiKeys);

      const response = await request(app)
        .get('/api/projects/proj123/api-keys');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(testApiKeys);
    });
  });

  describe('PUT /api/projects/:id/settings', () => {
    it('should update project settings', async () => {
      const settings = {
        webhookUrl: 'https://example.com/webhook',
        allowedOrigins: ['example.com']
      };

      mockProjectService.prototype.updateProjectSettings.mockResolvedValueOnce({
        projectId: '123',
        ...settings
      });

      const response = await request(app)
        .put('/api/projects/123/settings')
        .send(settings);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        projectId: '123',
        ...settings
      });
    });

    it('should return 404 for non-existent project', async () => {
      mockProjectService.prototype.updateProjectSettings.mockRejectedValueOnce(
        new NotFoundError('Project not found')
      );

      const response = await request(app)
        .put('/api/projects/999/settings')
        .send({ webhookUrl: 'https://example.com/webhook' });

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/projects/:projectId/api-keys/:keyId', () => {
    it('should revoke API key', async () => {
      const testApiKey = {
        id: '123',
        status: ApiKeyStatus.Revoked
      };

      mockApiKeyService.prototype.revokeApiKey.mockResolvedValueOnce(testApiKey);

      const response = await request(app)
        .delete('/api/projects/proj123/api-keys/123');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(testApiKey);
    });

    it('should return 404 for non-existent API key', async () => {
      mockApiKeyService.prototype.revokeApiKey.mockRejectedValueOnce(
        new NotFoundError('API key not found')
      );

      const response = await request(app)
        .delete('/api/projects/proj123/api-keys/999');

      expect(response.status).toBe(404);
    });
  });
}); 