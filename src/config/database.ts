import { Pool, PoolClient, QueryResult } from 'pg';
import config from '@/config/environment';
import { initializeSupabase, checkSupabaseHealth, isSupabaseConfigured, closeSupabase } from '@/config/supabase';

// Database connection pool
let pool: Pool | null = null;

// Database configuration
const dbConfig = {
  host: config.database.host,
  port: config.database.port,
  database: config.database.name,
  user: config.database.user,
  password: config.database.password,
  // Connection pool settings
  max: 20, // Maximum number of connections in the pool
  idleTimeoutMillis: 30000, // How long a client is allowed to remain idle
  connectionTimeoutMillis: 10000, // How long to wait for a connection (10 seconds for Supabase)
  // SSL configuration for production
  ssl: config.server.nodeEnv === 'production' ? { rejectUnauthorized: false } : false,
  // Additional PostgreSQL settings
  statement_timeout: 30000, // 30 seconds
  query_timeout: 30000,
  application_name: 'OneKey_KYC_API',
};

// Initialize database connection pool
export const initializeDatabase = async (): Promise<void> => {
  try {
    console.log('🔗 Initializing database connection...');
    
    // Check if Supabase is configured first
    if (isSupabaseConfigured()) {
      console.log('🌐 Supabase configuration detected, initializing Supabase...');
      initializeSupabase();
      
      // Also initialize PostgreSQL pool for direct database operations
      if (config.database.url.includes('supabase') || process.env.SUPABASE_DB_URL) {
        // Use Supabase database URL for direct connections
        const supabaseDbUrl = process.env.SUPABASE_DB_URL || config.database.url;
        pool = new Pool({
          connectionString: supabaseDbUrl,
          ssl: { rejectUnauthorized: false },
          max: 20,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 10000,
          statement_timeout: 30000,
          query_timeout: 30000,
          application_name: 'OneKey_KYC_API',
        });
      } else {
        // Fallback to regular database config
        pool = new Pool(dbConfig);
      }
      
      console.log('🎯 Using Supabase + PostgreSQL hybrid configuration');
    } else {
      console.log('🐘 Using direct PostgreSQL connection');
      pool = new Pool(dbConfig);
    }
    
    // Test the connection
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();
    
    console.log('✅ Database connection established successfully');
    
    if (isSupabaseConfigured()) {
      console.log(`📊 Supabase URL: ${config.supabase.url}`);
      console.log(`📊 PostgreSQL Pool: ${pool.options.host || 'connection string'}`);
    } else {
      console.log(`📊 Connected to: ${config.database.host}:${config.database.port}/${config.database.name}`);
    }
    
    // Set up connection event handlers
    pool.on('connect', (client) => {
      console.log(`🔗 New database client connected (Total: ${pool?.totalCount})`);
    });
    
    pool.on('error', (err) => {
      console.error('🚨 Database pool error:', err);
    });
    
    pool.on('remove', () => {
      console.log(`📤 Database client removed (Total: ${pool?.totalCount})`);
    });
    
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    throw new Error(`Database initialization failed: ${(error as Error).message}`);
  }
};

// Close database connection pool
export const closeDatabase = async (): Promise<void> => {
  console.log('🔌 Closing database connections...');
  
  // Close Supabase connections if configured
  if (isSupabaseConfigured()) {
    await closeSupabase();
  }
  
  // Close PostgreSQL pool
  if (pool) {
    await pool.end();
    pool = null;
  }
  
  console.log('✅ Database connections closed');
};

// Get database connection from pool
export const getDatabase = (): Pool => {
  if (!pool) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return pool;
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

// Database query wrapper with error handling
export const query = async (
  text: string,
  params?: any[]
): Promise<QueryResult> => {
  const pool = getDatabase();
  const client = await pool.connect();
  
  try {
    const start = Date.now();
    const result = await client.query(text, params);
    const duration = Date.now() - start;
    
    console.log(`📊 Query executed in ${duration}ms`);
    return result;
  } catch (error) {
    console.error('Database query error:', error);
    console.error('Query:', text);
    console.error('Params:', params);
    throw error;
  } finally {
    client.release();
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