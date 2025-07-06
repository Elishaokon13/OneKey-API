// Import environment configuration
require('ts-node/register');

const baseConfig = {
  client: 'postgresql',
  connection: {
    host: 'localhost',
    port: 5432,
    database: 'onekey_api',
    user: 'postgres',
    password: 'postgres',
    ssl: false
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
    connection: {
      ...baseConfig.connection,
      ssl: { rejectUnauthorized: false }
    }
  }
}; 