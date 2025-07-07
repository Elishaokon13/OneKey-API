import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Add RBAC configuration to project_settings
  await knex('project_settings').insert([
    {
      project_id: knex.raw('(SELECT id FROM projects LIMIT 1)'),
      key: 'rbac_config',
      value: JSON.stringify({
        enabled: true,
        roles: {
          admin: {
            description: 'Administrator role',
            permissions: ['all:*']
          },
          developer: {
            description: 'Developer role',
            permissions: ['api:write', 'api:read'],
            parent: 'admin'
          },
          user: {
            description: 'Regular user role',
            permissions: ['api:read'],
            parent: 'developer'
          }
        }
      })
    },
    {
      project_id: knex.raw('(SELECT id FROM projects LIMIT 1)'),
      key: 'abac_config',
      value: JSON.stringify({
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
      })
    }
  ]);
}

export async function down(knex: Knex): Promise<void> {
  // Remove RBAC configuration from project_settings
  await knex('project_settings')
    .where('key', 'rbac_config')
    .orWhere('key', 'abac_config')
    .del();
}