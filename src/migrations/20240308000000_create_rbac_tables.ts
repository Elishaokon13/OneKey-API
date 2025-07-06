import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Create role hierarchy table
  await knex.schema.createTable('role_hierarchy', (table) => {
    table.string('role_name').primary();
    table.string('parent_role_name').nullable();
    table.jsonb('metadata').notNullable().defaultTo('{}');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

    table.foreign('parent_role_name').references('role_hierarchy.role_name');
    table.index(['parent_role_name']);
  });

  // Create role permissions table
  await knex.schema.createTable('role_permissions', (table) => {
    table.increments('id').primary();
    table.string('role_name').notNullable();
    table.string('permission').notNullable();
    table.jsonb('metadata').notNullable().defaultTo('{}');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

    table.foreign('role_name').references('role_hierarchy.role_name');
    table.unique(['role_name', 'permission']);
    table.index(['role_name']);
    table.index(['permission']);
  });

  // Create user roles table
  await knex.schema.createTable('user_roles', (table) => {
    table.increments('id').primary();
    table.uuid('user_id').notNullable();
    table.string('role_name').notNullable();
    table.jsonb('metadata').notNullable().defaultTo('{}');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

    table.foreign('user_id').references('users.id');
    table.foreign('role_name').references('role_hierarchy.role_name');
    table.unique(['user_id', 'role_name']);
    table.index(['user_id']);
    table.index(['role_name']);
  });

  // Create role audit log table
  await knex.schema.createTable('role_audit_log', (table) => {
    table.increments('id').primary();
    table.uuid('user_id').notNullable();
    table.string('role_name').notNullable();
    table.string('action').notNullable();
    table.jsonb('metadata').notNullable().defaultTo('{}');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

    table.foreign('user_id').references('users.id');
    table.foreign('role_name').references('role_hierarchy.role_name');
    table.index(['user_id']);
    table.index(['role_name']);
    table.index(['action']);
    table.index(['created_at']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('role_audit_log');
  await knex.schema.dropTable('user_roles');
  await knex.schema.dropTable('role_permissions');
  await knex.schema.dropTable('role_hierarchy');
} 