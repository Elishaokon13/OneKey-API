"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const rateLimiter_1 = require("@/middleware/rateLimiter");
const privyAuth_1 = require("@/middleware/privyAuth");
const privyService_1 = require("@/services/auth/privyService");
const privy_1 = require("@/types/privy");
const router = (0, express_1.Router)();
/**
 * POST /api/v1/privy/authenticate
 * Authenticate with Privy access token and get OneKey JWT tokens
 */
router.post('/authenticate', rateLimiter_1.authLimiter, async (req, res) => {
    try {
        const { accessToken, metadata } = req.body;
        // Validation
        if (!accessToken) {
            res.status(400).json({
                error: 'VALIDATION_ERROR',
                message: 'accessToken is required',
                requestId: req.headers['x-request-id']
            });
            return;
        }
        // Check if Privy is configured
        if (!privyService_1.privyService.isConfigured()) {
            res.status(503).json({
                error: 'PRIVY_NOT_CONFIGURED',
                message: 'Privy authentication service is not configured',
                requestId: req.headers['x-request-id']
            });
            return;
        }
        const result = await privyService_1.privyService.authenticateWithPrivy({
            accessToken,
            metadata
        });
        res.status(200).json({
            success: true,
            message: 'Privy authentication successful',
            data: result,
            requestId: req.headers['x-request-id']
        });
    }
    catch (error) {
        if (error instanceof privy_1.PrivyAuthenticationError || error instanceof privy_1.PrivyVerificationError) {
            res.status(401).json({
                error: error.code,
                message: error.message,
                requestId: req.headers['x-request-id']
            });
            return;
        }
        console.error('Privy authentication error:', error);
        res.status(500).json({
            error: 'INTERNAL_ERROR',
            message: 'Privy authentication failed',
            requestId: req.headers['x-request-id']
        });
    }
});
/**
 * GET /api/v1/privy/profile
 * Get Privy user profile and linked accounts
 */
router.get('/profile', privyAuth_1.authenticatePrivy, async (req, res) => {
    try {
        if (!req.privyContext || !req.privyUser) {
            res.status(401).json({
                error: 'PRIVY_AUTH_REQUIRED',
                message: 'Privy authentication required',
                requestId: req.headers['x-request-id']
            });
            return;
        }
        const profile = {
            privyUser: {
                id: req.privyUser.id,
                did: req.privyUser.did,
                createdAt: req.privyUser.createdAt
            },
            context: {
                sessionId: req.privyContext.sessionId,
                isValid: req.privyContext.isValid,
                linkedWallets: req.privyContext.linkedWallets,
                linkedEmails: req.privyContext.linkedEmails
            },
            internalUser: req.user ? {
                id: req.user.id,
                email: req.user.email,
                wallet_address: req.user.wallet_address,
                is_active: req.user.is_active
            } : null
        };
        res.status(200).json({
            success: true,
            data: profile,
            requestId: req.headers['x-request-id']
        });
    }
    catch (error) {
        console.error('Get Privy profile error:', error);
        res.status(500).json({
            error: 'INTERNAL_ERROR',
            message: 'Failed to get Privy profile',
            requestId: req.headers['x-request-id']
        });
    }
});
/**
 * GET /api/v1/privy/status
 * Get Privy service status and configuration
 */
router.get('/status', async (req, res) => {
    try {
        const status = privyService_1.privyService.getHealthStatus();
        res.status(200).json({
            success: true,
            data: {
                service: 'Privy Authentication',
                status: status.configured && status.initialized ? 'operational' : 'unavailable',
                configured: status.configured,
                initialized: status.initialized,
                appId: status.appId
            },
            requestId: req.headers['x-request-id']
        });
    }
    catch (error) {
        console.error('Privy status error:', error);
        res.status(500).json({
            error: 'INTERNAL_ERROR',
            message: 'Failed to get Privy status',
            requestId: req.headers['x-request-id']
        });
    }
});
exports.default = router;
//# sourceMappingURL=privy.js.map