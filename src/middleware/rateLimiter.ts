import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import { config } from '../config/environment';

// General API rate limiter
export const generalLimiter = rateLimit({
  windowMs: config.security.rateLimitWindowMs, // 15 minutes
  max: config.security.rateLimitMaxRequests, // 100 requests per windowMs
  message: {
    error: 'Too Many Requests',
    message: 'Too many requests from this IP, please try again later.',
    retryAfter: Math.ceil(config.security.rateLimitWindowMs / 1000)
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    // Use IP + User Agent for more accurate rate limiting
    return `${req.ip}-${req.get('user-agent')}`;
  }
});

// Strict limiter for authentication endpoints
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Only 10 login attempts per 15 minutes
  message: {
    error: 'Authentication Rate Limited',
    message: 'Too many authentication attempts, please try again later.',
    retryAfter: 15 * 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful logins
});

// KYC operation limiter (more restrictive due to processing costs)
export const kycLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Only 5 KYC attempts per hour per IP
  message: {
    error: 'KYC Rate Limited',
    message: 'Too many KYC verification attempts, please try again later.',
    retryAfter: 60 * 60
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Attestation query limiter (moderate limits)
export const attestationLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 50, // 50 attestation queries per 5 minutes
  message: {
    error: 'Attestation Query Rate Limited',
    message: 'Too many attestation queries, please try again later.',
    retryAfter: 5 * 60
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Attestation creation/modification limiter (very restrictive due to blockchain costs)
export const applyAttestationRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Only 10 attestation operations per hour per IP
  message: {
    error: 'Attestation Operation Rate Limited',
    message: 'Too many attestation operations, please try again later.',
    retryAfter: 60 * 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    // Use IP + User ID for more accurate rate limiting
    return `${req.ip}-${req.user?.id || 'anonymous'}`;
  }
});

// Encryption operation limiter (moderate limits due to computational cost)
export const encryptionOperationsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 encryption/decryption operations per 15 minutes
  message: {
    error: 'Encryption Operation Rate Limited',
    message: 'Too many encryption operations, please try again later.',
    retryAfter: 15 * 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    // Use IP + User ID for more accurate rate limiting
    return `${req.ip}-${req.user?.id || 'anonymous'}`;
  }
});

// Key management limiter (restrictive due to security implications)
export const keyManagementLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 15, // Only 15 key operations per hour per user
  message: {
    error: 'Key Management Rate Limited',
    message: 'Too many key management operations, please try again later.',
    retryAfter: 60 * 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    // Use IP + User ID for more accurate rate limiting
    return `${req.ip}-${req.user?.id || 'anonymous'}`;
  }
});

// File encryption limiter (more restrictive due to potential large file sizes)
export const fileEncryptionLimiter = rateLimit({
  windowMs: 30 * 60 * 1000, // 30 minutes
  max: 10, // Only 10 file encryption operations per 30 minutes
  message: {
    error: 'File Encryption Rate Limited',
    message: 'Too many file encryption operations, please try again later.',
    retryAfter: 30 * 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    return `${req.ip}-${req.user?.id || 'anonymous'}`;
  }
});

// Export organized rate limiters for easy access
export const rateLimiter = {
  general: generalLimiter,
  auth: authLimiter,
  kyc: kycLimiter,
  attestation: attestationLimiter,
  attestationOperations: applyAttestationRateLimit,
  encryptionOperations: encryptionOperationsLimiter,
  keyManagement: keyManagementLimiter,
  fileEncryption: fileEncryptionLimiter
}; 