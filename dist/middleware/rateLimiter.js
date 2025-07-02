"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.attestationLimiter = exports.kycLimiter = exports.authLimiter = exports.generalLimiter = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const environment_1 = __importDefault(require("../config/environment"));
// General API rate limiter
exports.generalLimiter = (0, express_rate_limit_1.default)({
    windowMs: environment_1.default.security.rateLimitWindowMs, // 15 minutes
    max: environment_1.default.security.rateLimitMaxRequests, // 100 requests per windowMs
    message: {
        error: 'Too Many Requests',
        message: 'Too many requests from this IP, please try again later.',
        retryAfter: Math.ceil(environment_1.default.security.rateLimitWindowMs / 1000)
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        // Use IP + User Agent for more accurate rate limiting
        return `${req.ip}-${req.get('user-agent')}`;
    }
});
// Strict limiter for authentication endpoints
exports.authLimiter = (0, express_rate_limit_1.default)({
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
exports.kycLimiter = (0, express_rate_limit_1.default)({
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
exports.attestationLimiter = (0, express_rate_limit_1.default)({
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
//# sourceMappingURL=rateLimiter.js.map