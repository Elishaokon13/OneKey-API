import { Knex } from 'knex';

export async function seed(knex: Knex): Promise<void> {
  // Clean up existing data
  await knex('analytics_events').del();
  await knex('cost_tracking').del();
  await knex('performance_metrics').del();
  await knex('policy_audit_log').del();
  await knex('access_audit_log').del();
  await knex('role_audit_log').del();
  await knex('user_roles').del();
  await knex('role_permissions').del();
  await knex('role_hierarchy').del();
  await knex('policies').del();
  await knex('projects').del();
  await knex('organizations').del();
  await knex('users').del();

  // Insert test users
  const users = await knex('users').insert([
    {
      email: 'admin@onekey.com',
      name: 'Admin User',
      metadata: JSON.stringify({ isAdmin: true })
    },
    {
      email: 'dev@onekey.com',
      name: 'Developer User',
      metadata: JSON.stringify({ department: 'Engineering' })
    },
    {
      email: 'user@onekey.com',
      name: 'Regular User',
      metadata: JSON.stringify({})
    }
  ]).returning('*');

  // Insert test organizations
  const orgs = await knex('organizations').insert([
    {
      name: 'OneKey Main',
      slug: 'onekey-main',
      metadata: JSON.stringify({ industry: 'Technology' })
    },
    {
      name: 'OneKey Test Org',
      slug: 'onekey-test',
      metadata: JSON.stringify({ industry: 'Testing' })
    }
  ]).returning('*');

  // Insert test projects
  const projects = await knex('projects').insert([
    {
      name: 'Production API',
      slug: 'prod-api',
      organization_id: orgs[0].id,
      environment: 'production',
      type: 'api',
      status: 'active',
      metadata: JSON.stringify({ version: '1.0.0' })
    },
    {
      name: 'Staging API',
      slug: 'staging-api',
      organization_id: orgs[0].id,
      environment: 'staging',
      type: 'api',
      status: 'active',
      metadata: JSON.stringify({ version: '1.1.0-beta' })
    },
    {
      name: 'Test Project',
      slug: 'test-project',
      organization_id: orgs[1].id,
      environment: 'development',
      type: 'web',
      status: 'development',
      metadata: JSON.stringify({ isTest: true })
    }
  ]).returning('*');

  // Insert role hierarchy
  await knex('role_hierarchy').insert([
    {
      role_name: 'admin',
      parent_role_name: null,
      metadata: JSON.stringify({ description: 'Administrator role' })
    },
    {
      role_name: 'developer',
      parent_role_name: 'admin',
      metadata: JSON.stringify({ description: 'Developer role' })
    },
    {
      role_name: 'user',
      parent_role_name: 'developer',
      metadata: JSON.stringify({ description: 'Regular user role' })
    }
  ]);

  // Insert role permissions
  await knex('role_permissions').insert([
    {
      role_name: 'admin',
      permission: 'all:*',
      metadata: JSON.stringify({ description: 'Full access' })
    },
    {
      role_name: 'developer',
      permission: 'api:write',
      metadata: JSON.stringify({ description: 'API write access' })
    },
    {
      role_name: 'developer',
      permission: 'api:read',
      metadata: JSON.stringify({ description: 'API read access' })
    },
    {
      role_name: 'user',
      permission: 'api:read',
      metadata: JSON.stringify({ description: 'API read access' })
    }
  ]);

  // Assign roles to users
  await knex('user_roles').insert([
    {
      user_id: users[0].id,
      role_name: 'admin',
      metadata: JSON.stringify({ assigned_by: 'system' })
    },
    {
      user_id: users[1].id,
      role_name: 'developer',
      metadata: JSON.stringify({ assigned_by: 'admin' })
    },
    {
      user_id: users[2].id,
      role_name: 'user',
      metadata: JSON.stringify({ assigned_by: 'admin' })
    }
  ]);

  // Insert test policies
  await knex('policies').insert([
    {
      name: 'Production Access',
      description: 'Controls access to production environment',
      rules: JSON.stringify({
        environment: 'production',
        requiredRoles: ['admin']
      }),
      metadata: JSON.stringify({ priority: 'high' })
    },
    {
      name: 'Development Access',
      description: 'Controls access to development environment',
      rules: JSON.stringify({
        environment: 'development',
        requiredRoles: ['developer', 'admin']
      }),
      metadata: JSON.stringify({ priority: 'medium' })
    }
  ]);

  // Insert test analytics events
  await knex('analytics_events').insert([
    {
      project_id: projects[0].id,
      event_type: 'api_call',
      event_data: JSON.stringify({
        endpoint: '/api/v1/users',
        method: 'GET',
        status: 200
      })
    },
    {
      project_id: projects[1].id,
      event_type: 'error',
      event_data: JSON.stringify({
        error: 'Rate limit exceeded',
        status: 429
      })
    }
  ]);

  // Insert test performance metrics
  await knex('performance_metrics').insert([
    {
      project_id: projects[0].id,
      metric_name: 'response_time',
      metric_value: 150,
      metadata: JSON.stringify({ unit: 'ms' })
    },
    {
      project_id: projects[0].id,
      metric_name: 'cpu_usage',
      metric_value: 45,
      metadata: JSON.stringify({ unit: 'percent' })
    }
  ]);

  // Insert test cost tracking
  await knex('cost_tracking').insert([
    {
      project_id: projects[0].id,
      resource_type: 'api_calls',
      quantity: 1000,
      cost: 10.50,
      metadata: JSON.stringify({ billing_period: '2024-03' })
    },
    {
      project_id: projects[1].id,
      resource_type: 'storage',
      quantity: 5,
      cost: 25.00,
      metadata: JSON.stringify({ billing_period: '2024-03' })
    }
  ]);
} 