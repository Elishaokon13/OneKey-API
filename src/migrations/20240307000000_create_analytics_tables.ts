import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Create events table
  await knex.schema.createTable('analytics_events', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('project_id').notNullable();
    table.string('event_type').notNullable();
    table.string('category').notNullable();
    table.jsonb('metadata').notNullable().defaultTo('{}');
    table.timestamp('timestamp').notNullable();
    table.uuid('user_id');
    table.string('session_id');
    
    // Indexes
    table.index(['project_id', 'timestamp']);
    table.index(['event_type', 'timestamp']);
    table.index(['category', 'timestamp']);
    table.index(['user_id', 'timestamp']);
    
    // Foreign keys
    table.foreign('project_id').references('projects.id');
    table.foreign('user_id').references('users.id');
  });

  // Create performance metrics table
  await knex.schema.createTable('performance_metrics', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('project_id').notNullable();
    table.string('operation_type').notNullable();
    table.integer('duration_ms').notNullable();
    table.integer('memory_usage_bytes');
    table.jsonb('metadata').notNullable().defaultTo('{}');
    table.timestamp('timestamp').notNullable();
    
    // Indexes
    table.index(['project_id', 'timestamp']);
    table.index(['operation_type', 'timestamp']);
    
    // Foreign keys
    table.foreign('project_id').references('projects.id');
  });

  // Create cost tracking table
  await knex.schema.createTable('cost_tracking', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('project_id').notNullable();
    table.string('service').notNullable();
    table.string('operation_type').notNullable();
    table.decimal('cost_amount', 10, 6).notNullable();
    table.string('currency').notNullable().defaultTo('USD');
    table.jsonb('metadata').notNullable().defaultTo('{}');
    table.timestamp('timestamp').notNullable();
    
    // Indexes
    table.index(['project_id', 'timestamp']);
    table.index(['service', 'timestamp']);
    table.index(['operation_type', 'timestamp']);
    
    // Foreign keys
    table.foreign('project_id').references('projects.id');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('cost_tracking');
  await knex.schema.dropTable('performance_metrics');
  await knex.schema.dropTable('analytics_events');
} 