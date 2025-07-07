import { knex } from '../../config/database';
import { v4 as uuidv4 } from 'uuid';
import { Knex } from 'knex';

export const createTestOrganization = async (trx: Knex = knex) => {
  const [org] = await trx('organizations')
    .insert({
      name: 'Test Organization',
      slug: `test-org-${uuidv4()}`,
      billing_email: 'test@example.com',
      status: 'active',
      subscription_tier: 'free',
      subscription_status: 'active',
      metadata: {
        settings: {
          default_user_role: 'user',
          require_email_verification: true,
          allow_wallet_login: true
        }
      }
    })
    .returning('*');
  
  return org;
};

export const createTestProject = async (organizationId: string, trx: Knex = knex) => {
  const [project] = await trx('projects')
    .insert({
      organization_id: organizationId,
      name: 'Test Project',
      slug: `test-project-${uuidv4()}`,
      environment: 'development',
      status: 'active',
      metadata: {
        features: ['rbac', 'abac', 'analytics']
      }
    })
    .returning('*');

  // Add RBAC configuration
  await trx('project_settings').insert({
    project_id: project.id,
    key: 'rbac_config',
    value: {
      enabled: true,
      roles: {
        admin: {
          description: 'Administrator role',
          permissions: ['all:*']
        },
        developer: {
          description: 'Developer role',
          permissions: ['api:write', 'api:read']
        },
        user: {
          description: 'Regular user role',
          permissions: ['api:read']
        }
      }
    }
  });

  // Add ABAC configuration
  await trx('project_settings').insert({
    project_id: project.id,
    key: 'abac_config',
    value: {
      enabled: true,
      rules: [
        {
          name: 'Production Access',
          description: 'Controls access to production environment',
          conditions: {
            environment: 'production',
            requiredRoles: ['admin']
          }
        },
        {
          name: 'Development Access',
          description: 'Controls access to development environment',
          conditions: {
            environment: 'development',
            requiredRoles: ['developer', 'admin']
          }
        }
      ]
    }
  });

  return project;
};

export const createTestUser = async (
  projectId: string,
  role: string = 'user',
  email?: string,
  trx: Knex = knex
) => {
  const [user] = await trx('users')
    .insert({
      email: email || `test-${uuidv4()}@example.com`,
      project_id: projectId,
      metadata: {
        roles: [role],
        attributes: {
          department: 'Engineering',
          level: role === 'admin' ? 'Senior' : 'Junior'
        }
      }
    })
    .returning('*');

  return user;
};