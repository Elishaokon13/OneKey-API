import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Extend project_settings table
  await knex.schema.alterTable('project_settings', (table) => {
    // Add access control settings
    table.jsonb('access_control_rules').defaultTo('[]');
    table.jsonb('role_definitions').defaultTo('{}');
    table.boolean('rbac_enabled').defaultTo(false);
    table.boolean('abac_enabled').defaultTo(false);
  });

  // Extend project_usage_stats table
  await knex.schema.alterTable('project_usage_stats', (table) => {
    // Add detailed analytics fields
    table.jsonb('performance_metrics').defaultTo('{}');
    table.jsonb('cost_tracking').defaultTo('{}');
    table.integer('api_calls_count').defaultTo(0);
    table.integer('active_users_count').defaultTo(0);
  });

  // Extend audit_logs table
  await knex.schema.alterTable('audit_logs', (table) => {
    // Add fields for better audit tracking
    table.string('resource_type').nullable();
    table.string('resource_id').nullable();
    table.boolean('allowed').nullable();
    table.jsonb('request_context').defaultTo('{}');
    
    // Add indexes for better query performance
    table.index(['resource_type', 'resource_id']);
    table.index(['allowed']);
  });

  // Extend user_consents table
  await knex.schema.alterTable('user_consents', (table) => {
    // Add fields for role-based permissions
    table.string('role').nullable();
    table.jsonb('permissions').defaultTo('[]');
    table.timestamp('expires_at').nullable();
    
    // Add index for role lookups
    table.index(['role']);
  });
}

export async function down(knex: Knex): Promise<void> {
  // Revert project_settings changes
  await knex.schema.alterTable('project_settings', (table) => {
    table.dropColumn('access_control_rules');
    table.dropColumn('role_definitions');
    table.dropColumn('rbac_enabled');
    table.dropColumn('abac_enabled');
  });

  // Revert project_usage_stats changes
  await knex.schema.alterTable('project_usage_stats', (table) => {
    table.dropColumn('performance_metrics');
    table.dropColumn('cost_tracking');
    table.dropColumn('api_calls_count');
    table.dropColumn('active_users_count');
  });

  // Revert audit_logs changes
  await knex.schema.alterTable('audit_logs', (table) => {
    table.dropIndex(['resource_type', 'resource_id']);
    table.dropIndex(['allowed']);
    table.dropColumn('resource_type');
    table.dropColumn('resource_id');
    table.dropColumn('allowed');
    table.dropColumn('request_context');
  });

  // Revert user_consents changes
  await knex.schema.alterTable('user_consents', (table) => {
    table.dropIndex(['role']);
    table.dropColumn('role');
    table.dropColumn('permissions');
    table.dropColumn('expires_at');
  });
}
 