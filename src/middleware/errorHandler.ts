import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

// Custom error classes for OneKey KYC system
export class ApiError extends Error {
  public statusCode: number;
  public errorCode: string;
  public isOperational: boolean;

  constructor(
    message: string,
    statusCode: number = 500,
    errorCode: string = 'INTERNAL_ERROR',
    isOperational: boolean = true
  ) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.isOperational = isOperational;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends ApiError {
  constructor(message: string, field?: string) {
    super(
      field ? `Validation failed for field '${field}': ${message}` : `Validation failed: ${message}`,
      400,
      'VALIDATION_ERROR'
    );
  }
}

export class AuthenticationError extends ApiError {
  constructor(message: string = 'Authentication failed') {
    super(message, 401, 'AUTHENTICATION_ERROR');
  }
}

export class AuthorizationError extends ApiError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, 403, 'AUTHORIZATION_ERROR');
  }
}

export class KycError extends ApiError {
  constructor(message: string, provider?: string) {
    super(
      provider ? `KYC verification failed (${provider}): ${message}` : `KYC verification failed: ${message}`,
      422,
      'KYC_VERIFICATION_ERROR'
    );
  }
}

export class AttestationError extends ApiError {
  constructor(message: string) {
    super(`Attestation error: ${message}`, 422, 'ATTESTATION_ERROR');
  }
}

export class StorageError extends ApiError {
  constructor(message: string, provider?: string) {
    super(
      provider ? `Storage error (${provider}): ${message}` : `Storage error: ${message}`,
      503,
      'STORAGE_ERROR'
    );
  }
}

// Request ID middleware
export const requestId = (req: Request, res: Response, next: NextFunction) => {
  const requestId = uuidv4();
  req.headers['x-request-id'] = requestId;
  res.set('X-Request-ID', requestId);
  next();
};

// Enhanced logging middleware
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  const requestId = req.headers['x-request-id'];

  // Log request
  console.log(`[${new Date().toISOString()}] [${requestId}] ${req.method} ${req.originalUrl} - Started`);

  // Override res.end to capture response details
  const originalEnd = res.end.bind(res);
  res.end = function(chunk?: any, encoding?: any, cb?: () => void) {
    const duration = Date.now() - start;
    console.log(
      `[${new Date().toISOString()}] [${requestId}] ${req.method} ${req.originalUrl} - ${res.statusCode} - ${duration}ms`
    );
    return originalEnd(chunk, encoding, cb);
  };

  next();
};

// Global error handler
export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const requestId = req.headers['x-request-id'];

  // Log error details
  console.error(`[${new Date().toISOString()}] [${requestId}] Error:`, {
    message: error.message,
    stack: error.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('user-agent')
  });

  // Handle different error types
  if (error instanceof ApiError) {
    res.status(error.statusCode).json({
      error: error.errorCode,
      message: error.message,
      requestId,
      timestamp: new Date().toISOString()
    });
    return;
  }

  // Handle JWT errors
  if (error.name === 'JsonWebTokenError') {
    res.status(401).json({
      error: 'INVALID_TOKEN',
      message: 'Invalid authentication token',
      requestId,
      timestamp: new Date().toISOString()
    });
    return;
  }

  if (error.name === 'TokenExpiredError') {
    res.status(401).json({
      error: 'TOKEN_EXPIRED',
      message: 'Authentication token has expired',
      requestId,
      timestamp: new Date().toISOString()
    });
    return;
  }

  // Handle validation errors (from express-validator or similar)
  if (error.name === 'ValidationError') {
    res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: error.message,
      requestId,
      timestamp: new Date().toISOString()
    });
    return;
  }

  // Default server error
  res.status(500).json({
    error: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected error occurred',
    requestId,
    timestamp: new Date().toISOString()
  });
};

// Not found handler
export const notFoundHandler = (req: Request, res: Response): void => {
  const requestId = req.headers['x-request-id'];
  
  res.status(404).json({
    error: 'NOT_FOUND',
    message: `The requested resource ${req.method} ${req.originalUrl} was not found`,
    requestId,
    timestamp: new Date().toISOString()
  });
}; 