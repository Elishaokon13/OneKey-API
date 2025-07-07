import { Knex } from 'knex';

declare global {
  namespace NodeJS {
    interface Global {
      testTransaction: Knex.Transaction;
    }
  }
}

export {};
