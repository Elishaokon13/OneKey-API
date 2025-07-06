import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Create user_roles table
  await knex.schema.createTable('user_roles', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').notNullable();
    table.string('role').notNullable();
    table.uuid('project_id').notNullable();
    table.uuid('assigned_by').notNullable();
    table.timestamp('assigned_at').notNullable();
    table.uuid('removed_by');
    table.timestamp('removed_at');
    table.boolean('active').notNullable().defaultTo(true);
    table.jsonb('metadata').notNullable().defaultTo('{}');
    
    // Indexes
    table.index(['user_id', 'project_id', 'active']);
    table.index(['role', 'active']);
    table.index(['assigned_at']);
    
    // Foreign keys
    table.foreign('project_id').references('projects.id');
    table.foreign('user_id').references('users.id');
    table.foreign('assigned_by').references('users.id');
    table.foreign('removed_by').references('users.id');
  });

  // Create role_permissions table for custom role definitions
  await knex.schema.createTable('role_permissions', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('role').notNullable();
    table.string('permission').notNullable();
    table.uuid('project_id').notNullable();
    table.uuid('created_by').notNullable();
    table.timestamp('created_at').notNullable();
    table.boolean('active').notNullable().defaultTo(true);
    
    // Indexes
    table.index(['role', 'project_id', 'active']);
    table.index(['permission', 'active']);
    
    // Foreign keys
    table.foreign('project_id').references('projects.id');
    table.foreign('created_by').references('users.id');
    
    // Unique constraint
    table.unique(['role', 'permission', 'project_id']);
  });

  // Create role_hierarchy table
  await knex.schema.createTable('role_hierarchy', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('parent_role').notNullable();
    table.string('child_role').notNullable();
    table.uuid('project_id').notNullable();
    table.uuid('created_by').notNullable();
    table.timestamp('created_at').notNullable();
    table.boolean('active').notNullable().defaultTo(true);
    
    // Indexes
    table.index(['parent_role', 'project_id', 'active']);
    table.index(['child_role', 'active']);
    
    // Foreign keys
    table.foreign('project_id').references('projects.id');
    table.foreign('created_by').references('users.id');
    
    // Unique constraint
    table.unique(['parent_role', 'child_role', 'project_id']);
  });

  // Create role_audit_log table
  await knex.schema.createTable('role_audit_log', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').notNullable();
    table.string('action').notNullable();
    table.string('role').notNullable();
    table.uuid('project_id').notNullable();
    table.uuid('performed_by').notNullable();
    table.timestamp('timestamp').notNullable();
    table.jsonb('metadata').notNullable().defaultTo('{}');
    
    // Indexes
    table.index(['user_id', 'timestamp']);
    table.index(['project_id', 'timestamp']);
    table.index(['action', 'timestamp']);
    
    // Foreign keys
    table.foreign('project_id').references('projects.id');
    table.foreign('user_id').references('users.id');
    table.foreign('performed_by').references('users.id');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('role_audit_log');
  await knex.schema.dropTable('role_hierarchy');
  await knex.schema.dropTable('role_permissions');
  await knex.schema.dropTable('user_roles');
} 