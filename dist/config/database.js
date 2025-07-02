"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.transaction = exports.query = exports.checkDatabaseHealth = exports.getDatabase = exports.closeDatabase = exports.initializeDatabase = void 0;
const pg_1 = require("pg");
const environment_1 = __importDefault(require("./environment"));
const supabase_1 = require("./supabase");
// Database connection pool
let pool = null;
// Database configuration
const dbConfig = {
    host: environment_1.default.database.host,
    port: environment_1.default.database.port,
    database: environment_1.default.database.name,
    user: environment_1.default.database.user,
    password: environment_1.default.database.password,
    // Connection pool settings
    max: 20, // Maximum number of connections in the pool
    idleTimeoutMillis: 30000, // How long a client is allowed to remain idle
    connectionTimeoutMillis: 2000, // How long to wait for a connection
    // SSL configuration for production
    ssl: environment_1.default.server.nodeEnv === 'production' ? { rejectUnauthorized: false } : false,
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
            // Also initialize PostgreSQL pool for direct database operations
            if (environment_1.default.database.url.includes('supabase') || process.env.SUPABASE_DB_URL) {
                // Use Supabase database URL for direct connections
                const supabaseDbUrl = process.env.SUPABASE_DB_URL || environment_1.default.database.url;
                pool = new pg_1.Pool({
                    connectionString: supabaseDbUrl,
                    ssl: { rejectUnauthorized: false },
                    max: 20,
                    idleTimeoutMillis: 30000,
                    connectionTimeoutMillis: 2000,
                    statement_timeout: 30000,
                    query_timeout: 30000,
                    application_name: 'OneKey_KYC_API',
                });
            }
            else {
                // Fallback to regular database config
                pool = new pg_1.Pool(dbConfig);
            }
            console.log('🎯 Using Supabase + PostgreSQL hybrid configuration');
        }
        else {
            console.log('🐘 Using direct PostgreSQL connection');
            pool = new pg_1.Pool(dbConfig);
        }
        // Test the connection
        const client = await pool.connect();
        await client.query('SELECT NOW()');
        client.release();
        console.log('✅ Database connection established successfully');
        if ((0, supabase_1.isSupabaseConfigured)()) {
            console.log(`📊 Supabase URL: ${environment_1.default.supabase.url}`);
            console.log(`📊 PostgreSQL Pool: ${pool.options.host || 'connection string'}`);
        }
        else {
            console.log(`📊 Connected to: ${environment_1.default.database.host}:${environment_1.default.database.port}/${environment_1.default.database.name}`);
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
    // Close PostgreSQL pool
    if (pool) {
        await pool.end();
        pool = null;
    }
    console.log('✅ Database connections closed');
};
exports.closeDatabase = closeDatabase;
// Get database connection from pool
const getDatabase = () => {
    if (!pool) {
        throw new Error('Database not initialized. Call initializeDatabase() first.');
    }
    return pool;
};
exports.getDatabase = getDatabase;
// Database health check
const checkDatabaseHealth = async () => {
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