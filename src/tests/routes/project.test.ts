import { Request, Response } from 'express';
import { ProjectService } from '../../services/project/projectService';
import { OrganizationService } from '../../services/project/organizationService';
import { ApiKeyService } from '../../services/project/apiKeyService';
import { ProjectType, ProjectStatus, ApiKeyType, ApiKeyStatus } from '../../types/project';
import { NotFoundError } from '../../utils/errors';

// Mock services
jest.mock('../../services/project/projectService');
jest.mock('../../services/project/organizationService');
jest.mock('../../services/project/apiKeyService');

describe('Project Routes', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockProjectService: jest.Mocked<ProjectService>;
  let mockOrganizationService: jest.Mocked<OrganizationService>;
  let mockApiKeyService: jest.Mocked<ApiKeyService>;

  beforeEach(() => {
    mockProjectService = new ProjectService() as jest.Mocked<ProjectService>;
    mockOrganizationService = new OrganizationService(null as any) as jest.Mocked<OrganizationService>;
    mockApiKeyService = new ApiKeyService(null as any) as jest.Mocked<ApiKeyService>;

    mockReq = {
      params: {},
      body: {},
      query: {}
    };

    mockRes = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis()
    };
  });

  const testProject = {
    id: '123',
    name: 'Test Project',
    slug: 'test-project',
    organizationId: 'org123',
    type: ProjectType.Production,
    status: ProjectStatus.Active,
    createdAt: new Date('2025-07-06T01:29:26.221Z'),
    updatedAt: new Date('2025-07-06T01:29:26.221Z'),
    metadata: {}
  };

  const testProjects = [
    {
      id: '123',
      name: 'Test Project 1',
      slug: 'test-project-1',
      organizationId: 'org123',
      type: ProjectType.Production,
      status: ProjectStatus.Active,
      createdAt: new Date('2025-07-06T01:29:26.221Z'),
      updatedAt: new Date('2025-07-06T01:29:26.221Z'),
      metadata: {}
    },
    {
      id: '456',
      name: 'Test Project 2',
      slug: 'test-project-2',
      organizationId: 'org123',
      type: ProjectType.Sandbox,
      status: ProjectStatus.Active,
      createdAt: new Date('2025-07-06T01:29:26.221Z'),
      updatedAt: new Date('2025-07-06T01:29:26.221Z'),
      metadata: {}
    }
  ];

  const testApiKeyResponse = {
    apiKey: 'sk_test_123',
    apiKeyDetails: {
      id: '123',
      projectId: 'proj123',
      name: 'Test Key',
      type: ApiKeyType.Secret,
      status: ApiKeyStatus.Active,
      permissions: ['read', 'write'],
      hashedKey: 'hashed_key',
      createdBy: 'user123',
      createdAt: new Date('2025-07-06T01:29:26.221Z'),
      updatedAt: new Date('2025-07-06T01:29:26.221Z'),
      lastUsedAt: undefined,
      metadata: {}
    }
  };

  const testApiKeys = [
    {
      id: '123',
      projectId: 'proj123',
      name: 'Test Key 1',
      type: ApiKeyType.Secret,
      status: ApiKeyStatus.Active,
      permissions: ['read', 'write'],
      hashedKey: 'hashed_key_1',
      createdBy: 'user123',
      createdAt: new Date('2025-07-06T01:29:26.221Z'),
      updatedAt: new Date('2025-07-06T01:29:26.221Z'),
      lastUsedAt: undefined,
      metadata: {}
    },
    {
      id: '456',
      projectId: 'proj123',
      name: 'Test Key 2',
      type: ApiKeyType.Secret,
      status: ApiKeyStatus.Active,
      permissions: ['read'],
      hashedKey: 'hashed_key_2',
      createdBy: 'user123',
      createdAt: new Date('2025-07-06T01:29:26.221Z'),
      updatedAt: new Date('2025-07-06T01:29:26.221Z'),
      lastUsedAt: undefined,
      metadata: {}
    }
  ];

  const testSettings = {
    projectId: '123',
    webhookUrl: 'https://example.com/webhook',
    allowedOrigins: ['https://example.com'],
    updatedAt: new Date('2025-07-06T01:29:26.221Z')
  };

  describe('POST /api/projects', () => {
    it('should create a new project', async () => {
      mockReq.body = {
        name: 'Test Project',
        organizationId: 'org123',
        type: ProjectType.Production
      };

      mockProjectService.createProject.mockResolvedValueOnce(testProject);

      // @ts-ignore
      await projectRouter(mockReq as Request, mockRes as Response, jest.fn());

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith(testProject);
    });

    it('should return 400 for invalid input', async () => {
      mockReq.body = {
        name: '', // Invalid: empty name
        organizationId: 'org123',
        type: 'invalid_type' // Invalid: wrong enum value
      };

      // @ts-ignore
      await projectRouter(mockReq as Request, mockRes as Response, jest.fn());

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });
  });

  describe('GET /api/projects/:id', () => {
    it('should return project by id', async () => {
      mockReq.params = { id: '123' };
      mockProjectService.getProject.mockResolvedValueOnce(testProject);

      // @ts-ignore
      await projectRouter(mockReq as Request, mockRes as Response, jest.fn());

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(testProject);
    });

    it('should return 404 for non-existent project', async () => {
      mockReq.params = { id: '999' };
      mockProjectService.getProject.mockRejectedValueOnce(new NotFoundError('Project not found'));

      // @ts-ignore
      await projectRouter(mockReq as Request, mockRes as Response, jest.fn());

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });
  });

  describe('PUT /api/projects/:id', () => {
    it('should update project', async () => {
      mockReq.params = { id: '123' };
      mockReq.body = {
        name: 'Updated Project',
        metadata: { key: 'value' }
      };

      const updatedProject = {
        id: '123',
        ...mockReq.body,
        status: ProjectStatus.Active
      };

      mockProjectService.updateProject.mockResolvedValueOnce(updatedProject);

      // @ts-ignore
      await projectRouter(mockReq as Request, mockRes as Response, jest.fn());

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(updatedProject);
    });

    it('should return 404 for non-existent project', async () => {
      mockReq.params = { id: '999' };
      mockProjectService.updateProject.mockRejectedValueOnce(new NotFoundError('Project not found'));

      // @ts-ignore
      await projectRouter(mockReq as Request, mockRes as Response, jest.fn());

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });
  });

  describe('GET /api/organizations/:id/projects', () => {
    it('should return organization projects', async () => {
      mockReq.params = { id: 'org123' };
      mockProjectService.getProjectsByOrganization.mockResolvedValueOnce(testProjects);

      // @ts-ignore
      await projectRouter(mockReq as Request, mockRes as Response, jest.fn());

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(testProjects);
    });
  });

  describe('POST /api/projects/:id/api-keys', () => {
    it('should create API key', async () => {
      mockReq.params = { id: 'proj123' };
      mockReq.body = { name: 'Test Key' };

      mockApiKeyService.createApiKey.mockResolvedValueOnce(testApiKeyResponse);

      // @ts-ignore
      await projectRouter(mockReq as Request, mockRes as Response, jest.fn());

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith(testApiKeyResponse);
    });
  });

  describe('GET /api/projects/:id/api-keys', () => {
    it('should return project API keys', async () => {
      mockReq.params = { id: 'proj123' };
      mockApiKeyService.getProjectApiKeys.mockResolvedValueOnce(testApiKeys);

      // @ts-ignore
      await projectRouter(mockReq as Request, mockRes as Response, jest.fn());

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(testApiKeys);
    });
  });

  describe('PUT /api/projects/:id/settings', () => {
    it('should update project settings', async () => {
      mockReq.params = { id: '123' };
      mockReq.body = {
        webhookUrl: 'https://example.com/webhook',
        allowedOrigins: ['example.com']
      };

      mockProjectService.updateProjectSettings.mockResolvedValueOnce(testSettings);

      // @ts-ignore
      await projectRouter(mockReq as Request, mockRes as Response, jest.fn());

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(testSettings);
    });

    it('should return 404 for non-existent project', async () => {
      mockReq.params = { id: '999' };
      mockProjectService.updateProjectSettings.mockRejectedValueOnce(new NotFoundError('Project not found'));

      // @ts-ignore
      await projectRouter(mockReq as Request, mockRes as Response, jest.fn());

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });
  });

  describe('DELETE /api/projects/:projectId/api-keys/:keyId', () => {
    it('should revoke API key', async () => {
      mockReq.params = { projectId: 'proj123', keyId: '123' };
      mockApiKeyService.revokeApiKey.mockResolvedValueOnce(testApiKeyResponse.apiKeyDetails);

      // @ts-ignore
      await projectRouter(mockReq as Request, mockRes as Response, jest.fn());

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(testApiKeyResponse.apiKeyDetails);
    });

    it('should return 404 for non-existent API key', async () => {
      mockReq.params = { projectId: 'proj123', keyId: '999' };
      mockApiKeyService.revokeApiKey.mockRejectedValueOnce(new NotFoundError('API key not found'));

      // @ts-ignore
      await projectRouter(mockReq as Request, mockRes as Response, jest.fn());

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });
  });
}); 