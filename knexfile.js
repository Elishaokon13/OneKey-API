// Import environment configuration
require('ts-node/register');
require('dotenv').config();

const parseConnectionString = (connectionString) => {
  if (!connectionString) return null;
  
  return {
    connectionString,
    ssl: {
      rejectUnauthorized: false,
      ca: process.env.CA_CERT
    }
  };
};

const baseConfig = {
  client: 'postgresql',
  connection: process.env.DATABASE_URL ? 
    parseConnectionString(process.env.DATABASE_URL) :
    {
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
  },
  pool: {
    min: 2,
    max: 10
  }
};

module.exports = {
  development: {
    ...baseConfig
  },
  production: {
    ...baseConfig
  }
}; 