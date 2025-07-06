import { Request, Response } from 'express';
import { Pool } from 'pg';
import { MultiTenantMiddleware } from '../../middleware/multiTenant';
import { ProjectService } from '../../services/project/projectService';
import { ProjectType, ProjectStatus } from '../../types/project';
import { NotFoundError, ValidationError, AuthorizationError } from '../../utils/errors';

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
    createdAt: new Date(),
    updatedAt: new Date(),
    metadata: {
      rateLimit: 200
    }
  };

  beforeEach(() => {
    mockProjectService = new ProjectService(null as any) as jest.Mocked<ProjectService>;
    middleware = new MultiTenantMiddleware(null as any);

    mockReq = {
      header: jest.fn(),
      query: {},
      params: {},
      body: {},
      ip: '127.0.0.1'
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      getHeader: jest.fn().mockReturnValue('60')
    };

    mockNext = jest.fn();
  });

  describe('projectContext', () => {
    it('should attach project to request when valid project ID is provided', async () => {
      (mockReq.header as jest.Mock).mockReturnValue('proj123');
      mockProjectService.getProject.mockResolvedValue(testProject);

      await middleware.projectContext(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.project).toEqual(testProject);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle missing project ID', async () => {
      (mockReq.header as jest.Mock).mockReturnValue(null);

      await middleware.projectContext(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Project ID is required' });
    });

    it('should handle non-existent project', async () => {
      (mockReq.header as jest.Mock).mockReturnValue('nonexistent');
      mockProjectService.getProject.mockRejectedValue(new NotFoundError('Project not found'));

      await middleware.projectContext(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Project not found' });
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
    });

    it('should handle missing project context', async () => {
      mockReq.params = { projectId: 'proj123' };

      await middleware.resourceIsolation(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Project context is required' });
    });
  });

  describe('rateLimiting', () => {
    it('should apply rate limiting based on project settings', async () => {
      mockReq.project = testProject;
      
      // First request should pass
      middleware.rateLimiting(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();

      // Reset mockNext
      mockNext.mockClear();

      // Simulate many requests to trigger rate limit
      for (let i = 0; i < testProject.metadata.rateLimit + 1; i++) {
        middleware.rateLimiting(mockReq as Request, mockRes as Response, mockNext);
      }

      // Last request should be rate limited
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
    });
  });
}); 