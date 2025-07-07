import { Knex } from 'knex';

declare global {
  var testTransaction: Knex.Transaction | null;
}

export {};
