import { AccessControlService } from '../../services/auth/accessControlService';
import { knex } from '../../config/database';
import {
  createTestOrganization,
  createTestProject,
  createTestUser
} from '../fixtures/accessControl';

describe('AccessControlService', () => {
  let accessControlService: AccessControlService;
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

    accessControlService = new AccessControlService(trx);

    // Create test data
    testOrg = await createTestOrganization(trx);
    testProject = await createTestProject(testOrg.id, trx);
    
    // Create users with different roles
    adminUser = await createTestUser(testProject.id, 'admin', 'admin@test.com', trx);
    devUser = await createTestUser(testProject.id, 'developer', 'dev@test.com', trx);
    regularUser = await createTestUser(testProject.id, 'user', 'user@test.com', trx);
  });

  describe('RBAC', () => {
    it('should get RBAC config', async () => {
      const config = await accessControlService.getRBACConfig(testProject.id);
      expect(config).toBeDefined();
      expect(config?.enabled).toBe(true);
      expect(config?.roles).toHaveProperty('admin');
      expect(config?.roles).toHaveProperty('developer');
      expect(config?.roles).toHaveProperty('user');
    });

    it('should get user roles', async () => {
      const roles = await accessControlService.getUserRoles(adminUser.id);
      expect(roles).toContain('admin');
    });

    it('should verify admin has all permissions', async () => {
      const hasPermission = await accessControlService.hasPermission(
        adminUser.id,
        testProject.id,
        'all:*'
      );
      expect(hasPermission).toBe(true);
    });

    it('should verify developer has api:read permission', async () => {
      const hasPermission = await accessControlService.hasPermission(
        devUser.id,
        testProject.id,
        'api:read'
      );
      expect(hasPermission).toBe(true);
    });

    it('should verify regular user has limited permissions', async () => {
      const readPermission = await accessControlService.hasPermission(
        regularUser.id,
        testProject.id,
        'api:read'
      );
      expect(readPermission).toBe(true);

      const writePermission = await accessControlService.hasPermission(
        regularUser.id,
        testProject.id,
        'api:write'
      );
      expect(writePermission).toBe(false);
    });
  });

  describe('ABAC', () => {
    it('should get ABAC config', async () => {
      const config = await accessControlService.getABACConfig(testProject.id);
      expect(config).toBeDefined();
      expect(config?.enabled).toBe(true);
      expect(config?.rules).toHaveLength(2);
    });

    it('should allow admin access to production', async () => {
      const context = {
        environment: 'production'
      };

      const allowed = await accessControlService.evaluateABACRules(
        adminUser.id,
        testProject.id,
        context
      );
      expect(allowed).toBe(true);
    });

    it('should allow developer access to development', async () => {
      const context = {
        environment: 'development'
      };

      const allowed = await accessControlService.evaluateABACRules(
        devUser.id,
        testProject.id,
        context
      );
      expect(allowed).toBe(true);
    });

    it('should deny developer access to production', async () => {
      const context = {
        environment: 'production'
      };

      const allowed = await accessControlService.evaluateABACRules(
        devUser.id,
        testProject.id,
        context
      );
      expect(allowed).toBe(false);
    });

    it('should evaluate user attributes', async () => {
      const context = {
        environment: 'development',
        department: 'Engineering'
      };

      const allowed = await accessControlService.evaluateABACRules(
        devUser.id,
        testProject.id,
        context
      );
      expect(allowed).toBe(true);
    });
  });

  describe('Audit Logging', () => {
    it('should log access attempts', async () => {
      const context = { test: 'context' };
      
      await accessControlService.logAccessAttempt(
        adminUser.id,
        testProject.id,
        'test:action',
        true,
        context
      );

      const trx = global.testTransaction;
      if (!trx) {
        throw new Error('Test transaction not initialized');
      }

      const log = await trx('audit_logs')
        .where({
          user_id: adminUser.id,
          project_id: testProject.id,
          action: 'test:action'
        })
        .first();

      expect(log).toBeDefined();
      expect(log.allowed).toBe(true);
      expect(log.details).toHaveProperty('test', 'context');
    });

    it('should log failed access attempts', async () => {
      const context = { environment: 'production' };
      
      await accessControlService.logAccessAttempt(
        devUser.id,
        testProject.id,
        'production:access',
        false,
        context
      );

      const trx = global.testTransaction;
      if (!trx) {
        throw new Error('Test transaction not initialized');
      }

      const log = await trx('audit_logs')
        .where({
          user_id: devUser.id,
          project_id: testProject.id,
          action: 'production:access'
        })
        .first();

      expect(log).toBeDefined();
      expect(log.allowed).toBe(false);
      expect(log.details).toHaveProperty('environment', 'production');
    });
  });
});