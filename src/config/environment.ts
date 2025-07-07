import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export const config = {
  server: {
    nodeEnv: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '3000', 10),
    host: process.env.HOST || 'localhost'
  },
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    name: process.env.DB_NAME || 'onekey',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres'
  },
  redis: {
    enabled: process.env.REDIS_ENABLED !== 'false',
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || '',
    db: parseInt(process.env.REDIS_DB || '0', 10),
    keyPrefix: process.env.REDIS_KEY_PREFIX || 'onekey:',
    ttl: parseInt(process.env.REDIS_TTL || '3600', 10),
    queues: {
      auditLogs: {
        batchSize: parseInt(process.env.AUDIT_LOG_BATCH_SIZE || '100', 10),
        batchTimeout: parseInt(process.env.AUDIT_LOG_BATCH_TIMEOUT || '5000', 10)
      }
    }
  },
  rateLimiting: {
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX || '50', 10),
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || '60000', 10),
    blockDuration: parseInt(process.env.RATE_LIMIT_BLOCK_DURATION || '300000', 10)
  },
  blockchain: {
    easContractAddress: process.env.EAS_CONTRACT_ADDRESS || '0x4200000000000000000000000000000000000021'
  },
  supabase: {
    url: process.env.SUPABASE_URL || '',
    serviceKey: process.env.SUPABASE_SERVICE_KEY || ''
  }
}; 