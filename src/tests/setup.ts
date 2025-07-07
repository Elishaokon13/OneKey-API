import { knex } from '../config/database';
import { Knex } from 'knex';

declare global {
  var testTransaction: Knex.Transaction | null;
}

beforeAll(async () => {
  // Wait for database to be ready
  try {
    await knex.raw('SELECT 1');
  } catch (error) {
    console.error('Database connection failed:', error);
    throw error;
  }
});

beforeEach(async () => {
  // Start transaction for test isolation
  await knex.transaction(async (trx: Knex.Transaction) => {
    // Store the transaction for use in tests
    global.testTransaction = trx;
  });
});

afterEach(async () => {
  // Rollback transaction after each test
  if (global.testTransaction) {
    await global.testTransaction.rollback();
    global.testTransaction = null;
  }
});

afterAll(async () => {
  // Close database connection
  await knex.destroy();
}); 