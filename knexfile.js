// Import environment configuration
require('ts-node/register');
const { config } = require('./src/config/environment');

const baseConfig = {
  client: 'postgresql',
  migrations: {
    directory: './src/migrations',
    extension: 'ts'
  }
};

module.exports = {
  development: {
    ...baseConfig,
    connection: {
      host: config.database.host,
      port: config.database.port,
      database: config.database.name,
      user: config.database.user,
      password: config.database.password,
      ssl: false
    }
  },
  production: {
    ...baseConfig,
    connection: {
      host: config.database.host,
      port: config.database.port,
      database: config.database.name,
      user: config.database.user,
      password: config.database.password,
      ssl: { rejectUnauthorized: false }
    }
  }
}; 