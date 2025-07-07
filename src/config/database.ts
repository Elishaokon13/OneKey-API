import { Pool, PoolClient, QueryResult } from 'pg';
import { config } from './environment';
import { initializeSupabase, checkSupabaseHealth, isSupabaseConfigured, closeSupabase } from './supabase';
import knexLib from 'knex';

// Create Knex instance
export const knex = knexLib({
  client: 'pg',
  connection: {
    host: config.database.host,
    port: config.database.port,
    database: config.database.name,
    user: config.database.user,
    password: config.database.password,
    ssl: config.server.nodeEnv === 'production' ? { rejectUnauthorized: false } : false,
  },
  pool: {
    min: 2,
    max: 20,
    idleTimeoutMillis: 30000,
    acquireTimeoutMillis: 10000,
  }
});

// Database connection pool
let pool: Pool | null = null;

// Initialize database pool
const initializePool = () => {
  if (!pool) {
    pool = new Pool({
      host: config.database.host,
      port: config.database.port,
      database: config.database.name,
      user: config.database.user,
      password: config.database.password,
      ssl: config.server.nodeEnv === 'production' ? { rejectUnauthorized: false } : false,
    });
  }
  return pool;
};

// Get database pool
export const getDatabase = (): Pool => {
  return initializePool();
};

// Execute a query
export const query = async (text: string, params?: any[]): Promise<QueryResult> => {
  const pool = getDatabase();
  return pool.query(text, params);
};

// Get a client from the pool
export const getClient = async (): Promise<PoolClient> => {
  const pool = getDatabase();
  return pool.connect();
};

// Check database health
export const checkDatabaseHealth = async (): Promise<{
  status: string;
  details: {
    connected: boolean;
    postgresVersion?: string;
    uptime?: number;
  };
}> => {
  try {
    const pool = getDatabase();
    const result = await pool.query('SELECT version(), pg_postmaster_start_time()');
    
    return {
      status: 'healthy',
      details: {
        connected: true,
        postgresVersion: result.rows[0].version,
        uptime: Date.now() - new Date(result.rows[0].pg_postmaster_start_time).getTime(),
      }
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      details: {
        connected: false
      }
    };
  }
};

// Close database connections
export const closeDatabase = async (): Promise<void> => {
  if (pool) {
    await pool.end();
    pool = null;
  }
  await knex.destroy();
  await closeSupabase();
};

// Transaction wrapper
export const transaction = async <T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> => {
  const pool = getDatabase();
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Transaction rollback due to error:', error);
    throw error;
  } finally {
    client.release();
  }
}; 