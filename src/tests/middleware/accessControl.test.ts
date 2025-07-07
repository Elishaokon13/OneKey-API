import { Request, Response, NextFunction } from 'express';
import { requirePermission, requireEnvironment } from '../../middleware/accessControl';
import { AccessControlService } from '../../services/auth/accessControlService';
import { knex } from '../../config/database';
import {
  createTestOrganization,
  createTestProject,
  createTestUser
} from '../fixtures/accessControl';

describe('Access Control Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: jest.Mock;
  let testOrg: any;
  let testProject: any;
  let adminUser: any;
  let devUser: any;
  let regularUser: any;

  beforeEach(async () => {
    const trx = global.testTransaction;
    if (!trx) {
      throw new Error('Test transaction not initialized');
    }

    // Create test data
    testOrg = await createTestOrganization(trx);
    testProject = await createTestProject(testOrg.id, trx);
    adminUser = await createTestUser(testProject.id, 'admin', 'admin@test.com', trx);
    devUser = await createTestUser(testProject.id, 'developer', 'dev@test.com', trx);
    regularUser = await createTestUser(testProject.id, 'user', 'user@test.com', trx);

    // Mock Express objects
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    mockNext = jest.fn();
  });

  describe('requirePermission', () => {
    it('should allow admin access', async () => {
      mockReq = {
        user: { id: adminUser.id },
        project: { id: testProject.id },
        path: '/test',
        method: 'GET'
      };

      const middleware = requirePermission('api:write');
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should allow developer access to permitted actions', async () => {
      mockReq = {
        user: { id: devUser.id },
        project: { id: testProject.id },
        path: '/test',
        method: 'GET'
      };

      const middleware = requirePermission('api:read');
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should deny regular user access to restricted actions', async () => {
      mockReq = {
        user: { id: regularUser.id },
        project: { id: testProject.id },
        path: '/test',
        method: 'POST'
      };

      const middleware = requirePermission('api:write');
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Forbidden' });
    });

    it('should deny access without user or project', async () => {
      mockReq = {
        path: '/test',
        method: 'GET'
      };

      const middleware = requirePermission('api:read');
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    });
  });

  describe('requireEnvironment', () => {
    it('should allow admin access to production', async () => {
      mockReq = {
        user: { id: adminUser.id },
        project: { id: testProject.id },
        path: '/test',
        method: 'GET'
      };

      const middleware = requireEnvironment('production');
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should allow developer access to development', async () => {
      mockReq = {
        user: { id: devUser.id },
        project: { id: testProject.id },
        path: '/test',
        method: 'GET'
      };

      const middleware = requireEnvironment('development');
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should deny developer access to production', async () => {
      mockReq = {
        user: { id: devUser.id },
        project: { id: testProject.id },
        path: '/test',
        method: 'GET'
      };

      const middleware = requireEnvironment('production');
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Forbidden' });
    });

    it('should deny access without user or project', async () => {
      mockReq = {
        path: '/test',
        method: 'GET'
      };

      const middleware = requireEnvironment('development');
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    });
  });
}); 