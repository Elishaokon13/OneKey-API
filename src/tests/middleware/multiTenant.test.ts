import { Request, Response } from 'express';
import { Pool } from 'pg';
import { MultiTenantMiddleware } from '../../middleware/multiTenant';
import { ProjectService } from '../../services/project/projectService';
import { ProjectType, ProjectStatus } from '../../types/project';
import { NotFoundError } from '../../utils/errors';

// Mock express-rate-limit
jest.mock('express-rate-limit', () => {
  return jest.fn().mockImplementation((options) => {
    let hits = 0;
    return (req: Request, res: Response, next: Function) => {
      hits++;
      if (hits <= options.max(req)) {
        next();
      } else {
        options.handler(req, res);
      }
    };
  });
});

jest.mock('../../services/project/projectService');

describe('MultiTenantMiddleware', () => {
  let middleware: MultiTenantMiddleware;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: jest.Mock;
  let mockProjectService: jest.Mocked<ProjectService>;

  const testProject = {
    id: 'proj123',
    name: 'Test Project',
    slug: 'test-project',
    organizationId: 'org123',
    environment: 'production',
    type: ProjectType.Production,
    status: ProjectStatus.Active,
    createdAt: new Date('2025-07-06T01:29:26.221Z'),
    updatedAt: new Date('2025-07-06T01:29:26.221Z'),
    metadata: {
      rateLimit: 2 // Small number for testing
    }
  };

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Setup ProjectService mock
    mockProjectService = {
      getProject: jest.fn(),
      createProject: jest.fn(),
      updateProject: jest.fn(),
      getProjectsByOrganization: jest.fn(),
      updateProjectSettings: jest.fn(),
      getProjectSettings: jest.fn()
    } as unknown as jest.Mocked<ProjectService>;

    // Create middleware instance with mocked dependencies
    middleware = new MultiTenantMiddleware(mockProjectService);

    // Setup request mock
    mockReq = {
      header: jest.fn(),
      query: {},
      params: {},
      body: {},
      ip: '127.0.0.1'
    };

    // Setup response mock
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      getHeader: jest.fn().mockReturnValue('60')
    };

    // Setup next function mock
    mockNext = jest.fn();

    // Mock ProjectService.getProject to return testProject by default
    mockProjectService.getProject.mockResolvedValue(testProject);
  });

  describe('projectContext', () => {
    it('should attach project to request when valid project ID is provided', async () => {
      (mockReq.header as jest.Mock).mockReturnValue('proj123');

      await middleware.projectContext(mockReq as Request, mockRes as Response, mockNext);

      expect(mockProjectService.getProject).toHaveBeenCalledWith('proj123');
      expect(mockReq.project).toEqual(testProject);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle missing project ID', async () => {
      (mockReq.header as jest.Mock).mockReturnValue(null);

      await middleware.projectContext(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Project ID is required' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle non-existent project', async () => {
      (mockReq.header as jest.Mock).mockReturnValue('nonexistent');
      mockProjectService.getProject.mockRejectedValue(new NotFoundError('Project not found'));

      await middleware.projectContext(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Project not found' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle inactive project', async () => {
      (mockReq.header as jest.Mock).mockReturnValue('proj123');
      mockProjectService.getProject.mockResolvedValue({
        ...testProject,
        status: ProjectStatus.Inactive
      });

      await middleware.projectContext(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Project is not active' });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('resourceIsolation', () => {
    it('should allow access to own project resources', async () => {
      mockReq.project = testProject;
      mockReq.params = { projectId: 'proj123' };

      await middleware.resourceIsolation(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should deny access to other project resources', async () => {
      mockReq.project = testProject;
      mockReq.params = { projectId: 'other123' };

      await middleware.resourceIsolation(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Access denied to resource from different project'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle missing project context', async () => {
      mockReq.params = { projectId: 'proj123' };

      await middleware.resourceIsolation(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Project context is required' });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('rateLimiting', () => {
    it('should apply rate limiting based on project settings', () => {
      mockReq.project = testProject;
      
      // First request should pass
      middleware.rateLimiting(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();

      // Second request should pass (limit is 2)
      mockNext.mockClear();
      middleware.rateLimiting(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();

      // Third request should be rate limited
      mockNext.mockClear();
      middleware.rateLimiting(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(429);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Too many requests',
        retryAfter: '60'
      });
    });

    it('should handle missing project context', () => {
      middleware.rateLimiting(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Project context is required' });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });
}); 