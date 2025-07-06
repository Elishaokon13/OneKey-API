import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Create policies table
  await knex.schema.createTable('policies', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('name').notNullable();
    table.text('description');
    table.string('version').notNullable();
    table.jsonb('statements').notNullable();
    table.jsonb('metadata').notNullable().defaultTo('{}');
    table.uuid('created_by').notNullable();
    table.timestamp('created_at').notNullable();
    table.uuid('updated_by').notNullable();
    table.timestamp('updated_at').notNullable();
    table.uuid('deleted_by');
    table.timestamp('deleted_at');
    table.boolean('active').notNullable().defaultTo(true);
    
    // Indexes
    table.index(['name', 'version', 'active']);
    table.index(['created_at']);
    table.index(['updated_at']);
    
    // Foreign keys
    table.foreign('created_by').references('users.id');
    table.foreign('updated_by').references('users.id');
    table.foreign('deleted_by').references('users.id');
  });

  // Create policy_audit_log table
  await knex.schema.createTable('policy_audit_log', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('policy_id').notNullable();
    table.string('action').notNullable();
    table.jsonb('changes').notNullable();
    table.uuid('performed_by').notNullable();
    table.timestamp('timestamp').notNullable();
    table.jsonb('metadata').notNullable().defaultTo('{}');
    
    // Indexes
    table.index(['policy_id', 'timestamp']);
    table.index(['action', 'timestamp']);
    
    // Foreign keys
    table.foreign('policy_id').references('policies.id');
    table.foreign('performed_by').references('users.id');
  });

  // Create access_audit_log table
  await knex.schema.createTable('access_audit_log', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('request_id').notNullable();
    table.uuid('user_id').notNullable();
    table.string('action').notNullable();
    table.string('resource_type').notNullable();
    table.string('resource_id').notNullable();
    table.string('decision').notNullable();
    table.jsonb('matched_policies').notNullable();
    table.jsonb('context').notNullable();
    table.timestamp('timestamp').notNullable();
    table.string('reason');
    table.jsonb('metadata').notNullable().defaultTo('{}');
    
    // Indexes
    table.index(['request_id']);
    table.index(['user_id', 'timestamp']);
    table.index(['resource_type', 'resource_id']);
    table.index(['decision', 'timestamp']);
    
    // Foreign keys
    table.foreign('user_id').references('users.id');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('access_audit_log');
  await knex.schema.dropTable('policy_audit_log');
  await knex.schema.dropTable('policies');
} 