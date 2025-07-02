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