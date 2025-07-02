"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notFoundHandler = exports.errorHandler = exports.requestLogger = exports.requestId = exports.StorageError = exports.AttestationError = exports.KycError = exports.AuthorizationError = exports.AuthenticationError = exports.ValidationError = exports.ApiError = void 0;
const uuid_1 = require("uuid");
// Custom error classes for OneKey KYC system
class ApiError extends Error {
    statusCode;
    errorCode;
    isOperational;
    constructor(message, statusCode = 500, errorCode = 'INTERNAL_ERROR', isOperational = true) {
        super(message);
        this.statusCode = statusCode;
        this.errorCode = errorCode;
        this.isOperational = isOperational;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.ApiError = ApiError;
class ValidationError extends ApiError {
    constructor(message, field) {
        super(field ? `Validation failed for field '${field}': ${message}` : `Validation failed: ${message}`, 400, 'VALIDATION_ERROR');
    }
}
exports.ValidationError = ValidationError;
class AuthenticationError extends ApiError {
    constructor(message = 'Authentication failed') {
        super(message, 401, 'AUTHENTICATION_ERROR');
    }
}
exports.AuthenticationError = AuthenticationError;
class AuthorizationError extends ApiError {
    constructor(message = 'Insufficient permissions') {
        super(message, 403, 'AUTHORIZATION_ERROR');
    }
}
exports.AuthorizationError = AuthorizationError;
class KycError extends ApiError {
    constructor(message, provider) {
        super(provider ? `KYC verification failed (${provider}): ${message}` : `KYC verification failed: ${message}`, 422, 'KYC_VERIFICATION_ERROR');
    }
}
exports.KycError = KycError;
class AttestationError extends ApiError {
    constructor(message) {
        super(`Attestation error: ${message}`, 422, 'ATTESTATION_ERROR');
    }
}
exports.AttestationError = AttestationError;
class StorageError extends ApiError {
    constructor(message, provider) {
        super(provider ? `Storage error (${provider}): ${message}` : `Storage error: ${message}`, 503, 'STORAGE_ERROR');
    }
}
exports.StorageError = StorageError;
// Request ID middleware
const requestId = (req, res, next) => {
    const requestId = (0, uuid_1.v4)();
    req.headers['x-request-id'] = requestId;
    res.set('X-Request-ID', requestId);
    next();
};
exports.requestId = requestId;
// Enhanced logging middleware
const requestLogger = (req, res, next) => {
    const start = Date.now();
    const requestId = req.headers['x-request-id'];
    // Log request
    console.log(`[${new Date().toISOString()}] [${requestId}] ${req.method} ${req.originalUrl} - Started`);
    // Override res.end to capture response details
    const originalEnd = res.end.bind(res);
    res.end = function (chunk, encoding, cb) {
        const duration = Date.now() - start;
        console.log(`[${new Date().toISOString()}] [${requestId}] ${req.method} ${req.originalUrl} - ${res.statusCode} - ${duration}ms`);
        return originalEnd(chunk, encoding, cb);
    };
    next();
};
exports.requestLogger = requestLogger;
// Global error handler
const errorHandler = (error, req, res, next) => {
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
exports.errorHandler = errorHandler;
// Not found handler
const notFoundHandler = (req, res) => {
    const requestId = req.headers['x-request-id'];
    res.status(404).json({
        error: 'NOT_FOUND',
        message: `The requested resource ${req.method} ${req.originalUrl} was not found`,
        requestId,
        timestamp: new Date().toISOString()
    });
};
exports.notFoundHandler = notFoundHandler;
//# sourceMappingURL=errorHandler.js.map