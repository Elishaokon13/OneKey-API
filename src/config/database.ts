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

// Close database connections
export const closeDatabase = async (): Promise<void> => {
  if (pool) {
    await pool.end();
    pool = null;
  }
  await knex.destroy();
  await closeSupabase();
};

// Database health check
export const checkDatabaseHealth = async (): Promise<{
  status: string;
  details: {
    connected: boolean;
    totalConnections: number;
    idleConnections: number;
    waitingConnections: number;
    serverVersion?: string;
    uptime?: string;
    supabase?: {
      status: string;
      publicClient: boolean;
      serviceClient: boolean;
      url?: string;
    };
  };
}> => {
  // Handle Supabase-only mode
  if (isSupabaseConfigured() && !pool) {
    const supabaseStatus = await checkSupabaseHealth();
    return {
      status: supabaseStatus.status === 'healthy' ? 'healthy' : 'unhealthy',
      details: {
        connected: supabaseStatus.details.connected,
        totalConnections: 0, // N/A for Supabase mode
        idleConnections: 0,  // N/A for Supabase mode
        waitingConnections: 0, // N/A for Supabase mode
        serverVersion: 'Supabase (managed)',
        uptime: 'N/A (managed service)',
        supabase: {
          status: supabaseStatus.status,
          publicClient: supabaseStatus.details.publicClient,
          serviceClient: supabaseStatus.details.serviceClient,
          ...(supabaseStatus.details.url && { url: supabaseStatus.details.url }),
        },
      },
    };
  }

  if (!pool) {
    return {
      status: 'disconnected',
      details: {
        connected: false,
        totalConnections: 0,
        idleConnections: 0,
        waitingConnections: 0,
      },
    };
  }

  try {
    const client = await pool.connect();
    
    // Get server info
    const versionResult = await client.query('SELECT version()');
    const uptimeResult = await client.query('SELECT EXTRACT(EPOCH FROM (now() - pg_postmaster_start_time())) as uptime');
    
    client.release();

    const baseHealthDetails = {
      connected: true,
      totalConnections: pool.totalCount,
      idleConnections: pool.idleCount,
      waitingConnections: pool.waitingCount,
      serverVersion: versionResult.rows[0]?.version || 'Unknown',
      uptime: `${Math.floor(uptimeResult.rows[0]?.uptime || 0)} seconds`,
    };

    // Check Supabase health if configured
    if (isSupabaseConfigured()) {
      const supabaseStatus = await checkSupabaseHealth();
      return {
        status: 'healthy',
        details: {
          ...baseHealthDetails,
          supabase: {
            status: supabaseStatus.status,
            publicClient: supabaseStatus.details.publicClient,
            serviceClient: supabaseStatus.details.serviceClient,
            ...(supabaseStatus.details.url && { url: supabaseStatus.details.url }),
          },
        },
      };
    }

    return {
      status: 'healthy',
      details: baseHealthDetails,
    };
  } catch (error) {
    console.error('Database health check failed:', error);
    return {
      status: 'unhealthy',
      details: {
        connected: false,
        totalConnections: pool.totalCount,
        idleConnections: pool.idleCount,
        waitingConnections: pool.waitingCount,
      },
    };
  }
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