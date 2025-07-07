import { AccessControlService } from '../../services/auth/accessControlService';
import { knex } from '../../config/database';

describe('AccessControlService', () => {
  let accessControlService: AccessControlService;
  let testProjectId: string;
  let testUserId: string;

  beforeAll(async () => {
    accessControlService = new AccessControlService(knex);

    // Get test project and user IDs
    const project = await knex('projects')
      .where({ slug: 'test-project' })
      .first();
    testProjectId = project.id;

    const user = await knex('users')
      .where({ email: 'admin@example.com' })
      .first();
    testUserId = user.id;
  });

  describe('RBAC', () => {
    it('should get RBAC config', async () => {
      const config = await accessControlService.getRBACConfig(testProjectId);
      expect(config).toBeDefined();
      expect(config.enabled).toBe(true);
      expect(config.roles).toHaveProperty('admin');
      expect(config.roles).toHaveProperty('developer');
      expect(config.roles).toHaveProperty('user');
    });

    it('should get user roles', async () => {
      const roles = await accessControlService.getUserRoles(testUserId);
      expect(roles).toContain('admin');
    });

    it('should verify admin permission', async () => {
      const hasPermission = await accessControlService.hasPermission(
        testUserId,
        testProjectId,
        'all:*'
      );
      expect(hasPermission).toBe(true);
    });

    it('should verify specific permission inheritance', async () => {
      // Create a developer user
      const devUser = await knex('users')
        .insert({
          email: 'dev@example.com',
          project_id: testProjectId,
          metadata: {
            roles: ['developer'],
            attributes: {
              department: 'Engineering'
            }
          }
        })
        .returning('id');

      const hasPermission = await accessControlService.hasPermission(
        devUser[0].id,
        testProjectId,
        'api:read'
      );
      expect(hasPermission).toBe(true);
    });
  });

  describe('ABAC', () => {
    it('should get ABAC config', async () => {
      const config = await accessControlService.getABACConfig(testProjectId);
      expect(config).toBeDefined();
      expect(config.enabled).toBe(true);
      expect(config.rules).toHaveLength(2);
    });

    it('should evaluate ABAC rules', async () => {
      const context = {
        environment: 'development',
      };

      const allowed = await accessControlService.evaluateABACRules(
        testUserId,
        testProjectId,
        context
      );
      expect(allowed).toBe(true);
    });

    it('should respect environment restrictions', async () => {
      const context = {
        environment: 'production',
      };

      // Create a developer user
      const devUser = await knex('users')
        .insert({
          email: 'dev2@example.com',
          project_id: testProjectId,
          metadata: {
            roles: ['developer'],
            attributes: {
              department: 'Engineering'
            }
          }
        })
        .returning('id');

      const allowed = await accessControlService.evaluateABACRules(
        devUser[0].id,
        testProjectId,
        context
      );
      expect(allowed).toBe(false);
    });
  });

  describe('Audit Logging', () => {
    it('should log access attempts', async () => {
      await accessControlService.logAccessAttempt(
        testUserId,
        testProjectId,
        'test:action',
        true,
        { test: 'context' }
      );

      const log = await knex('audit_logs')
        .where({
          user_id: testUserId,
          project_id: testProjectId,
          action: 'test:action'
        })
        .first();

      expect(log).toBeDefined();
      expect(log.allowed).toBe(true);
      expect(log.details).toHaveProperty('test', 'context');
    });
  });
});