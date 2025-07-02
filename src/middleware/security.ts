import { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import { config } from '../config/environment';

// Enhanced helmet configuration for KYC API
export const securityHeaders = helmet({
  // Content Security Policy
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  
  // Cross-Origin settings (strict for KYC)
  crossOriginEmbedderPolicy: { policy: "require-corp" },
  crossOriginOpenerPolicy: { policy: "same-origin" },
  crossOriginResourcePolicy: { policy: "same-origin" },
  
  // HTTP Strict Transport Security (HSTS)
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  },
  
  // Additional security headers
  referrerPolicy: { policy: "no-referrer" },
  noSniff: true,
  xssFilter: true,
  frameguard: { action: 'deny' }
});

// CORS configuration for KYC API
export const corsOptions = {
  origin: function (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = config.security.corsOrigin.split(',').map(o => o.trim());
    
    if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS policy'), false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'X-Request-ID',
    'X-API-Key'
  ],
  exposedHeaders: ['X-Request-ID', 'X-RateLimit-Limit', 'X-RateLimit-Remaining']
};

// Request sanitization middleware
export const sanitizeRequest = (req: Request, res: Response, next: NextFunction): void => {
  // Remove potentially dangerous characters from request body
  if (req.body && typeof req.body === 'object') {
    sanitizeObject(req.body);
  }
  
  // Remove potentially dangerous characters from query parameters
  if (req.query && typeof req.query === 'object') {
    sanitizeObject(req.query);
  }
  
  next();
};

// Recursive function to sanitize object properties
function sanitizeObject(obj: any): void {
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      if (typeof obj[key] === 'string') {
        // Remove potential XSS attacks
        obj[key] = obj[key]
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
          .replace(/javascript:/gi, '')
          .replace(/on\w+\s*=/gi, '');
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        sanitizeObject(obj[key]);
      }
    }
  }
}

// IP validation middleware
export const validateIp = (req: Request, res: Response, next: NextFunction): void => {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  
  // Log IP for security monitoring
  console.log(`[${new Date().toISOString()}] Request from IP: ${ip}`);
  
  // Add IP to request for later use
  req.clientIp = ip;
  
  next();
};

// API key validation middleware (for server-to-server communication)
export const validateApiKey = (req: Request, res: Response, next: NextFunction): void => {
  const apiKey = req.headers['x-api-key'] as string;
  
  if (!apiKey) {
    res.status(401).json({
      error: 'API_KEY_MISSING',
      message: 'API key is required for this endpoint'
    });
    return;
  }
  
  // In production, this should validate against a secure store
  // For now, we'll use environment variable
  const validApiKey = process.env.API_KEY;
  
  if (validApiKey && apiKey !== validApiKey) {
    res.status(401).json({
      error: 'INVALID_API_KEY',
      message: 'Invalid API key provided'
    });
    return;
  }
  
  next();
};

// Content-Type validation for POST/PUT requests
export const validateContentType = (req: Request, res: Response, next: NextFunction): void => {
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    const contentType = req.headers['content-type'];
    
    if (!contentType || (!contentType.includes('application/json') && !contentType.includes('multipart/form-data'))) {
      res.status(400).json({
        error: 'INVALID_CONTENT_TYPE',
        message: 'Content-Type must be application/json or multipart/form-data'
      });
      return;
    }
  }
  
  next();
};

// Request size validation
export const validateRequestSize = (req: Request, res: Response, next: NextFunction): void => {
  const contentLength = req.headers['content-length'];
  const maxSize = 10 * 1024 * 1024; // 10MB limit for KYC documents
  
  if (contentLength && parseInt(contentLength) > maxSize) {
    res.status(413).json({
      error: 'REQUEST_TOO_LARGE',
      message: 'Request payload too large. Maximum size is 10MB.'
    });
    return;
  }
  
  next();
};

// Declare custom properties for Request type
declare global {
  namespace Express {
    interface Request {
      clientIp?: string;
    }
  }
} 