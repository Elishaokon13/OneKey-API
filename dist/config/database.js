"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transaction = exports.query = exports.checkDatabaseHealth = exports.getDatabase = exports.closeDatabase = exports.initializeDatabase = void 0;
const pg_1 = require("pg");
const environment_1 = require("./environment");
const supabase_1 = require("./supabase");
// Database connection pool
let pool = null;
// Database configuration
const dbConfig = {
    host: environment_1.config.database.host,
    port: environment_1.config.database.port,
    database: environment_1.config.database.name,
    user: environment_1.config.database.user,
    password: environment_1.config.database.password,
    // Connection pool settings
    max: 20, // Maximum number of connections in the pool
    idleTimeoutMillis: 30000, // How long a client is allowed to remain idle
    connectionTimeoutMillis: 10000, // How long to wait for a connection (10 seconds for Supabase)
    // SSL configuration for production
    ssl: environment_1.config.server.nodeEnv === 'production' ? { rejectUnauthorized: false } : false,
    // Additional PostgreSQL settings
    statement_timeout: 30000, // 30 seconds
    query_timeout: 30000,
    application_name: 'OneKey_KYC_API',
};
// Initialize database connection pool
const initializeDatabase = async () => {
    try {
        console.log('🔗 Initializing database connection...');
        // Check if Supabase is configured first
        if ((0, supabase_1.isSupabaseConfigured)()) {
            console.log('🌐 Supabase configuration detected, initializing Supabase...');
            (0, supabase_1.initializeSupabase)();
            console.log('🎯 Using Supabase-only configuration (recommended)');
            // Skip direct PostgreSQL connection when using Supabase
            // All database operations will use Supabase clients
            console.log('✅ Database initialization completed (Supabase mode)');
            return;
        }
        else {
            console.log('🐘 Using direct PostgreSQL connection');
            pool = new pg_1.Pool(dbConfig);
            // Test the connection only for direct PostgreSQL
            const client = await pool.connect();
            await client.query('SELECT NOW()');
            client.release();
        }
        console.log('✅ Database connection established successfully');
        if ((0, supabase_1.isSupabaseConfigured)()) {
            console.log(`📊 Supabase URL: ${environment_1.config.supabase.url}`);
            if (pool) {
                console.log(`📊 PostgreSQL Pool: ${pool.options.host || 'connection string'}`);
            }
        }
        else {
            console.log(`📊 Connected to: ${environment_1.config.database.host}:${environment_1.config.database.port}/${environment_1.config.database.name}`);
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
    }
    catch (error) {
        console.error('❌ Database connection failed:', error);
        throw new Error(`Database initialization failed: ${error.message}`);
    }
};
exports.initializeDatabase = initializeDatabase;
// Close database connection pool
const closeDatabase = async () => {
    console.log('🔌 Closing database connections...');
    // Close Supabase connections if configured
    if ((0, supabase_1.isSupabaseConfigured)()) {
        await (0, supabase_1.closeSupabase)();
    }
    // Close PostgreSQL pool (only if using direct PostgreSQL)
    if (pool) {
        await pool.end();
        pool = null;
    }
    console.log('✅ Database connections closed');
};
exports.closeDatabase = closeDatabase;
// Get database connection from pool
const getDatabase = () => {
    if ((0, supabase_1.isSupabaseConfigured)() && !pool) {
        throw new Error('Using Supabase-only mode. Use getSupabaseClient() or getSupabaseServiceClient() instead.');
    }
    if (!pool) {
        throw new Error('Database not initialized. Call initializeDatabase() first.');
    }
    return pool;
};
exports.getDatabase = getDatabase;
// Database health check
const checkDatabaseHealth = async () => {
    // Handle Supabase-only mode
    if ((0, supabase_1.isSupabaseConfigured)() && !pool) {
        const supabaseStatus = await (0, supabase_1.checkSupabaseHealth)();
        return {
            status: supabaseStatus.status === 'healthy' ? 'healthy' : 'unhealthy',
            details: {
                connected: supabaseStatus.details.connected,
                totalConnections: 0, // N/A for Supabase mode
                idleConnections: 0, // N/A for Supabase mode
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
        if ((0, supabase_1.isSupabaseConfigured)()) {
            const supabaseStatus = await (0, supabase_1.checkSupabaseHealth)();
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
    }
    catch (error) {
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
exports.checkDatabaseHealth = checkDatabaseHealth;
// Database query wrapper with error handling
const query = async (text, params) => {
    const pool = (0, exports.getDatabase)();
    const client = await pool.connect();
    try {
        const start = Date.now();
        const result = await client.query(text, params);
        const duration = Date.now() - start;
        console.log(`📊 Query executed in ${duration}ms`);
        return result;
    }
    catch (error) {
        console.error('Database query error:', error);
        console.error('Query:', text);
        console.error('Params:', params);
        throw error;
    }
    finally {
        client.release();
    }
};
exports.query = query;
// Transaction wrapper
const transaction = async (callback) => {
    const pool = (0, exports.getDatabase)();
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
    }
    catch (error) {
        await client.query('ROLLBACK');
        console.error('Transaction rollback due to error:', error);
        throw error;
    }
    finally {
        client.release();
    }
};
exports.transaction = transaction;
//# sourceMappingURL=database.js.map