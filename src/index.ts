import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { config } from './config/environment';
import { initializeDatabase, closeDatabase, checkDatabaseHealth } from './config/database';
import { runMigrations } from './database/migrator';

// Import routes
import authRoutes from '@/routes/auth';
import privyRoutes from '@/routes/privy';
import kycRoutes from '@/routes/kyc';
import attestationRoutes from '@/routes/attestation';
import encryptionRoutes from '@/routes/encryption';
import { privyService } from './services/auth/privyService';

// Import custom middleware
import { generalLimiter } from './middleware/rateLimiter';
import { 
  requestId, 
  requestLogger, 
  errorHandler, 
  notFoundHandler 
} from './middleware/errorHandler';
import { 
  securityHeaders, 
  corsOptions, 
  sanitizeRequest, 
  validateIp, 
  validateContentType, 
  validateRequestSize 
} from './middleware/security';

// Load environment variables
dotenv.config();

const app = express();
const PORT = config.server.port;

// Trust proxy (important for rate limiting and IP detection)
app.set('trust proxy', 1);

// Request ID generation (must be first)
app.use(requestId);

// Security middleware
app.use(securityHeaders);
app.use(cors(corsOptions));

// Request validation and sanitization
app.use(validateIp);
app.use(validateRequestSize);
app.use(validateContentType);

// Rate limiting (applied globally)
app.use(generalLimiter);

// Request logging
app.use(requestLogger);

// Body parsing middleware (with size limits)
app.use(express.json({ 
  limit: '10mb',
  verify: (req, res, buf) => {
    // Store raw body for signature verification if needed
    (req as any).rawBody = buf;
  }
}));
app.use(express.urlencoded({ 
  extended: true, 
  limit: '10mb' 
}));

// Request sanitization (after body parsing)
app.use(sanitizeRequest);

// Health check endpoint (before other routes)
app.get('/health', async (req, res) => {
  try {
    const dbHealth = await checkDatabaseHealth();
    const privyHealth = privyService.getHealthStatus();
    const attestationHealth = await attestationService.getHealthStatus();
    
    // Determine overall status
    let overallStatus = 'OK';
    if (dbHealth.status !== 'healthy' || attestationHealth.status === 'unhealthy') {
      overallStatus = 'DEGRADED';
    }
    
    res.status(overallStatus === 'OK' ? 200 : 503).json({
      status: overallStatus,
      service: 'OneKey KYC API',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      environment: config.server.nodeEnv,
      uptime: process.uptime(),
      components: {
        database: dbHealth,
        privy: {
          status: privyHealth.configured && privyHealth.initialized ? 'operational' : 'disabled',
          configured: privyHealth.configured,
          initialized: privyHealth.initialized,
          appId: privyHealth.appId
        },
        attestations: {
          status: attestationHealth.status,
          initialized: attestationHealth.details.initialized,
          chainId: attestationHealth.services.eas.details.chainId,
          attesterAddress: attestationHealth.services.eas.details.attesterAddress,
          cacheSize: attestationHealth.details.cacheSize
        }
      },
      requestId: req.headers['x-request-id']
    });
  } catch (error) {
    res.status(503).json({
      status: 'ERROR',
      service: 'OneKey KYC API',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      environment: config.server.nodeEnv,
      uptime: process.uptime(),
      components: {
        database: { status: 'error', error: (error as Error).message },
        privy: { status: 'error', error: 'Health check failed' },
        attestations: { status: 'error', error: 'Health check failed' }
      },
      requestId: req.headers['x-request-id']
    });
  }
});

// API v1 routes
app.get('/api/v1', (req, res) => {
  res.status(200).json({
    service: 'OneKey KYC API',
    version: '1.0.0',
    description: 'Privacy-preserving identity verification system with reusable attestations',
    documentation: '/api/v1/docs',
    endpoints: {
      health: '/health',
      authentication: {
        login: 'POST /api/v1/auth/login',
        register: 'POST /api/v1/auth/register',
        refresh: 'POST /api/v1/auth/refresh',
        logout: 'POST /api/v1/auth/logout'
      },
      privy: {
        authenticate: 'POST /api/v1/privy/authenticate',
        profile: 'GET /api/v1/privy/profile',
        status: 'GET /api/v1/privy/status'
      },
      kyc: {
        createSession: 'POST /api/v1/kyc/sessions',
        getSession: 'GET /api/v1/kyc/sessions/:sessionId',
        startVerification: 'POST /api/v1/kyc/sessions/:sessionId/verify',
        getResult: 'GET /api/v1/kyc/sessions/:sessionId/result',
        listSessions: 'GET /api/v1/kyc/sessions',
        providers: 'GET /api/v1/kyc/providers',
        providersHealth: 'GET /api/v1/kyc/providers/health'
      },
      attestations: {
        create: 'POST /api/v1/attestations',
        get: 'GET /api/v1/attestations/:uid',
        verify: 'POST /api/v1/attestations/verify',
        list: 'GET /api/v1/attestations',
        revoke: 'POST /api/v1/attestations/revoke',
        estimateCost: 'POST /api/v1/attestations/estimate-cost',
        health: 'GET /api/v1/attestations/health',
        stats: 'GET /api/v1/attestations/stats'
      },
      storage: {
        encrypt: 'POST /api/v1/storage/encrypt',
        decrypt: 'POST /api/v1/storage/decrypt',
        upload: 'POST /api/v1/storage/upload'
      },
      user: {
        profile: 'GET /api/v1/user/profile',
        consent: 'POST /api/v1/user/consent',
        revoke: 'POST /api/v1/user/revoke'
      }
    },
    features: [
      'Multi-provider KYC verification',
      'Zero PII storage architecture',
      'EAS attestation creation',
      'Decentralized storage (Filecoin/Arweave)',
      'Selective disclosure with ZKPs',
      'Cross-platform KYC reuse'
    ],
    security: {
      rateLimit: 'Enabled',
      cors: 'Configured',
      helmet: 'Enabled',
      requestSanitization: 'Enabled'
    },
    requestId: req.headers['x-request-id'],
    timestamp: new Date().toISOString()
  });
});

// API documentation endpoint
app.get('/api/v1/docs', (req, res) => {
  res.status(200).json({
    title: 'OneKey KYC API Documentation',
    version: '1.0.0',
    description: 'Complete API documentation for OneKey KYC system',
    baseUrl: `http://localhost:${PORT}/api/v1`,
    authentication: {
      type: 'Bearer Token (JWT)',
      header: 'Authorization: Bearer <token>',
      endpoints: {
        login: 'POST /auth/login',
        refresh: 'POST /auth/refresh'
      }
    },
    rateLimits: {
      general: '100 requests per 15 minutes',
      authentication: '10 requests per 15 minutes',
      kyc: '5 requests per hour',
      attestations: '50 requests per 5 minutes (queries), 10 per hour (operations)'
    },
    errorCodes: {
      'VALIDATION_ERROR': 'Request validation failed',
      'AUTHENTICATION_ERROR': 'Authentication failed',
      'AUTHORIZATION_ERROR': 'Insufficient permissions',
      'KYC_VERIFICATION_ERROR': 'KYC verification failed',
      'ATTESTATION_ERROR': 'Attestation creation/verification failed',
      'STORAGE_ERROR': 'Decentralized storage error',
      'RATE_LIMITED': 'Too many requests'
    },
    requestId: req.headers['x-request-id'],
    timestamp: new Date().toISOString()
  });
});

// API route handlers
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/privy', privyRoutes);
app.use('/api/v1/kyc', kycRoutes);
app.use('/api/v1/attestations', attestationRoutes);
app.use('/api/v1/encryption', encryptionRoutes);

app.use('/api/v1/storage', (req, res) => {
  res.status(501).json({
    error: 'NOT_IMPLEMENTED',
    message: 'Storage endpoints not yet implemented',
    availableIn: 'Task 4.1',
    requestId: req.headers['x-request-id']
  });
});

app.use('/api/v1/user', (req, res) => {
  res.status(501).json({
    error: 'NOT_IMPLEMENTED',
    message: 'User management endpoints not yet implemented',
    availableIn: 'Task 2.3',
    requestId: req.headers['x-request-id']
  });
});

// 404 handler (must be after all routes)
app.use(notFoundHandler);

// Global error handler (must be last)
app.use(errorHandler);

// Initialize application
const startServer = async () => {
  try {
    console.log('🚀 Initializing OneKey KYC API...');
    
    // Initialize database connection
    await initializeDatabase();
    
    // Run database migrations
    await runMigrations();
    
    // Initialize attestation service
    console.log('🔗 Initializing attestation service...');
    await attestationService.initialize();
    
    // Start HTTP server
    const server = app.listen(PORT, () => {
      console.log('🚀 OneKey KYC API Server Started');
      console.log('=====================================');
      console.log(`📍 Server URL: http://localhost:${PORT}`);
      console.log(`📊 Environment: ${config.server.nodeEnv}`);
      console.log(`🏥 Health Check: http://localhost:${PORT}/health`);
      console.log(`📖 API Documentation: http://localhost:${PORT}/api/v1/docs`);
      console.log(`🔗 API Base: http://localhost:${PORT}/api/v1`);
      console.log('=====================================');
      console.log('✅ Security Features:');
      console.log('   • Rate limiting enabled');
      console.log('   • CORS configured');
      console.log('   • Security headers (Helmet)');
      console.log('   • Request sanitization');
      console.log('   • Request ID tracking');
      console.log('   • Enhanced error handling');
      console.log('=====================================');
    });
    
    return server;
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Start the server
const serverPromise = startServer();

// Graceful shutdown
const shutdown = async (signal: string) => {
  console.log(`\n🛑 ${signal} received, shutting down gracefully...`);
  
  try {
    // Get server instance
    const server = await serverPromise;
    
    // Close HTTP server
    server.close(async () => {
      console.log('🔌 HTTP server closed');
      
      // Close database connections
      await closeDatabase();
      
      console.log('✅ OneKey KYC API server closed');
      process.exit(0);
    });
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }

  // Force close after 30 seconds
  setTimeout(() => {
    console.error('❌ Forced shutdown due to timeout');
    process.exit(1);
  }, 30000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('🚨 Uncaught Exception:', error);
  shutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('🚨 Unhandled Rejection at:', promise, 'reason:', reason);
  shutdown('UNHANDLED_REJECTION');
});

export default app; 