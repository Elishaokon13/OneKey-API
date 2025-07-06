import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Create policies table
  await knex.schema.createTable('policies', (table) => {
    table.increments('id').primary();
    table.string('name').notNullable().unique();
    table.string('description').notNullable();
    table.jsonb('rules').notNullable();
    table.jsonb('metadata').notNullable().defaultTo('{}');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

    table.index(['name']);
  });

  // Create policy audit log table
  await knex.schema.createTable('policy_audit_log', (table) => {
    table.increments('id').primary();
    table.integer('policy_id').notNullable();
    table.uuid('user_id').notNullable();
    table.string('action').notNullable();
    table.jsonb('metadata').notNullable().defaultTo('{}');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

    table.foreign('policy_id').references('policies.id');
    table.foreign('user_id').references('users.id');
    table.index(['policy_id']);
    table.index(['user_id']);
    table.index(['action']);
    table.index(['created_at']);
  });

  // Create access audit log table
  await knex.schema.createTable('access_audit_log', (table) => {
    table.increments('id').primary();
    table.uuid('user_id').notNullable();
    table.string('resource_type').notNullable();
    table.string('resource_id').notNullable();
    table.string('action').notNullable();
    table.boolean('allowed').notNullable();
    table.jsonb('metadata').notNullable().defaultTo('{}');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

    table.foreign('user_id').references('users.id');
    table.index(['user_id']);
    table.index(['resource_type', 'resource_id']);
    table.index(['action']);
    table.index(['allowed']);
    table.index(['created_at']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('access_audit_log');
  await knex.schema.dropTable('policy_audit_log');
  await knex.schema.dropTable('policies');
} 