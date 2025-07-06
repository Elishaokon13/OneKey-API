// Import environment configuration
require('ts-node/register');
require('dotenv').config();

const parseConnectionString = (connectionString) => {
  if (!connectionString) return null;
  
  // Handle connection string with ssl parameter
  const sslParam = connectionString.split('?')[1]?.split('&')
    .find(param => param.startsWith('sslmode='));
  
  return {
    connectionString,
    ssl: sslParam === 'sslmode=disable' ? false : { rejectUnauthorized: false }
  };
};

const baseConfig = {
  client: 'postgresql',
  connection: process.env.SUPABASE_DB_URL ? 
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