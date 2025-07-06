import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Create analytics events table
  await knex.schema.createTable('analytics_events', (table) => {
    table.increments('id').primary();
    table.uuid('project_id').notNullable();
    table.string('event_type').notNullable();
    table.jsonb('event_data').notNullable();
    table.jsonb('metadata').notNullable().defaultTo('{}');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

    table.foreign('project_id').references('projects.id');
    table.index(['project_id']);
    table.index(['event_type']);
    table.index(['created_at']);
  });

  // Create performance metrics table
  await knex.schema.createTable('performance_metrics', (table) => {
    table.increments('id').primary();
    table.uuid('project_id').notNullable();
    table.string('metric_name').notNullable();
    table.float('metric_value').notNullable();
    table.jsonb('metadata').notNullable().defaultTo('{}');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

    table.foreign('project_id').references('projects.id');
    table.index(['project_id']);
    table.index(['metric_name']);
    table.index(['created_at']);
  });

  // Create cost tracking table
  await knex.schema.createTable('cost_tracking', (table) => {
    table.increments('id').primary();
    table.uuid('project_id').notNullable();
    table.string('resource_type').notNullable();
    table.integer('quantity').notNullable();
    table.decimal('cost', 10, 2).notNullable();
    table.jsonb('metadata').notNullable().defaultTo('{}');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

    table.foreign('project_id').references('projects.id');
    table.index(['project_id']);
    table.index(['resource_type']);
    table.index(['created_at']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('cost_tracking');
  await knex.schema.dropTable('performance_metrics');
  await knex.schema.dropTable('analytics_events');
} 