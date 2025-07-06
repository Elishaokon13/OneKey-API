// Import environment configuration
require('ts-node/register');
require('dotenv').config();

const baseConfig = {
  client: 'postgresql',
  connection: process.env.DATABASE_URL || {
    host: 'localhost',
    port: 5432,
    database: 'onekey_api',
    user: 'postgres',
    password: 'postgres',
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  },
  migrations: {
    directory: './src/migrations',
    extension: 'ts'
  },
  seeds: {
    directory: './src/seeds',
    extension: 'ts'
  }
};

module.exports = {
  development: {
    ...baseConfig
  },
  production: {
    ...baseConfig,
    connection: process.env.DATABASE_URL ? {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    } : baseConfig.connection
  }
}; 