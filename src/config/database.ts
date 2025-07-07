import { Pool } from 'pg';
import knex from 'knex';
import { config as envConfig } from './environment';
import { isSupabaseConfigured } from './supabase';
import { logger } from '../utils/logger';

// Database configuration
export const dbConfig = {
  client: 'postgresql',
  connection: process.env.DATABASE_URL ? {
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false,
      ca: process.env.CA_CERT
    }
  } : {
    host: envConfig.database.host,
    port: envConfig.database.port,
    database: envConfig.database.name,
    user: envConfig.database.user,
    password: envConfig.database.password,
    ssl: envConfig.server.nodeEnv === 'production'
  },
  pool: {
    min: 2,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000
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

// Initialize knex instance
export const knexInstance = knex(dbConfig);

// Export knex for use in other modules
export { knex };

// Pool configuration for direct pg access
const poolConfig = {
  ...dbConfig.connection,
  max: dbConfig.pool.max,
  idleTimeoutMillis: dbConfig.pool.idleTimeoutMillis,
  connectionTimeoutMillis: dbConfig.pool.connectionTimeoutMillis,
  application_name: 'OneKey_API',
  statement_timeout: 30000,
  query_timeout: 30000
};

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool(poolConfig);
    
    // Set up connection event handlers
    pool.on('connect', () => {
      logger.info(`New database client connected (Total: ${pool?.totalCount})`);
    });

    pool.on('error', (err) => {
      logger.error('Database pool error:', { error: err });
    });
  }
  return pool;
}

export async function initializeDatabase(): Promise<void> {
  try {
    logger.info('Initializing database connection...');

    if (isSupabaseConfigured()) {
      logger.info('Using Supabase configuration');
      return;
    }

    // Initialize pool
    const dbPool = getPool();
    const client = await dbPool.connect();
    await client.query('SELECT NOW()');
    client.release();

    // Run migrations
    await knexInstance.migrate.latest();

    logger.info('Database initialized successfully', {
      host: dbConfig.connection.host,
      database: dbConfig.connection.database
    });
  } catch (error) {
    logger.error('Failed to initialize database:', { error });
    throw error;
  }
}

export async function closeDatabase(): Promise<void> {
  try {
    logger.info('Closing database connections...');

    if (pool) {
      await pool.end();
      pool = null;
    }

    await knexInstance.destroy();
    
    logger.info('Database connections closed');
  } catch (error) {
    logger.error('Error closing database connections:', { error });
    throw error;
  }
}

export async function checkDatabaseHealth(): Promise<{
  status: string;
  details: {
    connected: boolean;
    totalConnections: number;
    idleConnections: number;
    waitingConnections: number;
    serverVersion?: string;
    uptime?: string;
  };
}> {
  try {
    const dbPool = getPool();
    const client = await dbPool.connect();
    
    const [versionResult, uptimeResult] = await Promise.all([
      client.query('SELECT version()'),
      client.query('SELECT extract(epoch from current_timestamp - pg_postmaster_start_time())::integer as uptime')
    ]);

    client.release();

    return {
      status: 'healthy',
      details: {
        connected: true,
        totalConnections: dbPool.totalCount,
        idleConnections: dbPool.idleCount,
        waitingConnections: dbPool.waitingCount,
        serverVersion: versionResult.rows[0].version,
        uptime: `${Math.floor(uptimeResult.rows[0].uptime / 3600)} hours`
      }
    };
  } catch (error) {
    logger.error('Database health check failed:', { error });
    return {
      status: 'unhealthy',
      details: {
        connected: false,
        totalConnections: 0,
        idleConnections: 0,
        waitingConnections: 0
      }
    };
  }
} 