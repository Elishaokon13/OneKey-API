"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const rateLimiter_1 = require("@/middleware/rateLimiter");
const auth_1 = require("@/middleware/auth");
const authService_1 = require("@/services/auth/authService");
const jwtService_1 = require("@/services/auth/jwtService");
const auth_2 = require("@/types/auth");
const router = (0, express_1.Router)();
/**
 * POST /api/v1/auth/register
 * Register a new user with email and password
 */
router.post('/register', rateLimiter_1.authLimiter, async (req, res) => {
    try {
        const { email, password, wallet_address, passkey_id, metadata } = req.body;
        // Validation
        if (!email || !password) {
            res.status(400).json({
                error: 'VALIDATION_ERROR',
                message: 'Email and password are required',
                requestId: req.headers['x-request-id']
            });
            return;
        }
        if (password.length < 8) {
            res.status(400).json({
                error: 'VALIDATION_ERROR',
                message: 'Password must be at least 8 characters long',
                requestId: req.headers['x-request-id']
            });
            return;
        }
        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            res.status(400).json({
                error: 'VALIDATION_ERROR',
                message: 'Invalid email format',
                requestId: req.headers['x-request-id']
            });
            return;
        }
        const result = await authService_1.authService.register({
            email: email.toLowerCase(),
            password,
            wallet_address: wallet_address || undefined,
            passkey_id: passkey_id || undefined,
            metadata: metadata || undefined
        });
        res.status(201).json({
            success: true,
            message: 'User registered successfully',
            data: result,
            requestId: req.headers['x-request-id']
        });
    }
    catch (error) {
        if (error instanceof auth_2.AuthenticationError) {
            res.status(400).json({
                error: error.code,
                message: error.message,
                requestId: req.headers['x-request-id']
            });
            return;
        }
        console.error('Registration error:', error);
        res.status(500).json({
            error: 'INTERNAL_ERROR',
            message: 'Registration failed',
            requestId: req.headers['x-request-id']
        });
    }
});
/**
 * POST /api/v1/auth/login
 * Login with email and password
 */
router.post('/login', rateLimiter_1.authLimiter, async (req, res) => {
    try {
        const { email, password } = req.body;
        // Validation
        if (!email || !password) {
            res.status(400).json({
                error: 'VALIDATION_ERROR',
                message: 'Email and password are required',
                requestId: req.headers['x-request-id']
            });
            return;
        }
        const result = await authService_1.authService.login({
            email: email.toLowerCase(),
            password
        });
        res.status(200).json({
            success: true,
            message: 'Login successful',
            data: result,
            requestId: req.headers['x-request-id']
        });
    }
    catch (error) {
        if (error instanceof auth_2.AuthenticationError) {
            res.status(401).json({
                error: error.code,
                message: error.message,
                requestId: req.headers['x-request-id']
            });
            return;
        }
        console.error('Login error:', error);
        res.status(500).json({
            error: 'INTERNAL_ERROR',
            message: 'Login failed',
            requestId: req.headers['x-request-id']
        });
    }
});
/**
 * POST /api/v1/auth/wallet-login
 * Login with wallet signature
 */
router.post('/wallet-login', rateLimiter_1.authLimiter, async (req, res) => {
    try {
        const { wallet_address, signature, message, nonce } = req.body;
        // Validation
        if (!wallet_address || !signature || !message || !nonce) {
            res.status(400).json({
                error: 'VALIDATION_ERROR',
                message: 'wallet_address, signature, message, and nonce are required',
                requestId: req.headers['x-request-id']
            });
            return;
        }
        const result = await authService_1.authService.walletLogin({
            wallet_address: wallet_address.toLowerCase(),
            signature,
            message,
            nonce
        });
        res.status(200).json({
            success: true,
            message: 'Wallet login successful',
            data: result,
            requestId: req.headers['x-request-id']
        });
    }
    catch (error) {
        if (error instanceof auth_2.AuthenticationError) {
            res.status(401).json({
                error: error.code,
                message: error.message,
                requestId: req.headers['x-request-id']
            });
            return;
        }
        console.error('Wallet login error:', error);
        res.status(500).json({
            error: 'INTERNAL_ERROR',
            message: 'Wallet login failed',
            requestId: req.headers['x-request-id']
        });
    }
});
/**
 * POST /api/v1/auth/refresh
 * Refresh access token using refresh token
 */
router.post('/refresh', rateLimiter_1.authLimiter, async (req, res) => {
    try {
        const { refresh_token } = req.body;
        if (!refresh_token) {
            res.status(400).json({
                error: 'VALIDATION_ERROR',
                message: 'refresh_token is required',
                requestId: req.headers['x-request-id']
            });
            return;
        }
        const tokens = await authService_1.authService.refreshToken(refresh_token);
        res.status(200).json({
            success: true,
            message: 'Token refreshed successfully',
            data: tokens,
            requestId: req.headers['x-request-id']
        });
    }
    catch (error) {
        if (error instanceof auth_2.AuthenticationError) {
            res.status(401).json({
                error: error.code,
                message: error.message,
                requestId: req.headers['x-request-id']
            });
            return;
        }
        console.error('Token refresh error:', error);
        res.status(500).json({
            error: 'INTERNAL_ERROR',
            message: 'Token refresh failed',
            requestId: req.headers['x-request-id']
        });
    }
});
/**
 * POST /api/v1/auth/logout
 * Logout user (revoke refresh token)
 */
router.post('/logout', auth_1.authenticateJWT, async (req, res) => {
    try {
        const { refresh_token } = req.body;
        if (refresh_token) {
            // Revoke the specific refresh token
            jwtService_1.jwtService.revokeRefreshToken(refresh_token);
        }
        else {
            // Revoke all user's refresh tokens
            jwtService_1.jwtService.revokeAllUserTokens(req.user.id);
        }
        res.status(200).json({
            success: true,
            message: 'Logout successful',
            requestId: req.headers['x-request-id']
        });
    }
    catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({
            error: 'INTERNAL_ERROR',
            message: 'Logout failed',
            requestId: req.headers['x-request-id']
        });
    }
});
/**
 * GET /api/v1/auth/me
 * Get current user profile
 */
router.get('/me', auth_1.authenticateJWT, async (req, res) => {
    try {
        const user = req.user;
        // Remove sensitive metadata
        const { metadata, ...publicUser } = user;
        res.status(200).json({
            success: true,
            data: {
                user: publicUser
            },
            requestId: req.headers['x-request-id']
        });
    }
    catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({
            error: 'INTERNAL_ERROR',
            message: 'Failed to get user profile',
            requestId: req.headers['x-request-id']
        });
    }
});
/**
 * GET /api/v1/auth/nonce
 * Get a nonce for wallet signature
 */
router.get('/nonce', async (req, res) => {
    try {
        const nonce = jwtService_1.jwtService.generateNonce();
        const message = jwtService_1.jwtService.createWalletMessage(nonce);
        res.status(200).json({
            success: true,
            data: {
                nonce,
                message
            },
            requestId: req.headers['x-request-id']
        });
    }
    catch (error) {
        console.error('Nonce generation error:', error);
        res.status(500).json({
            error: 'INTERNAL_ERROR',
            message: 'Failed to generate nonce',
            requestId: req.headers['x-request-id']
        });
    }
});
/**
 * GET /api/v1/auth/status
 * Check authentication status and token validity
 */
router.get('/status', auth_1.authenticateJWT, async (req, res) => {
    try {
        const tokenInfo = jwtService_1.jwtService.getTokenInfo(req.token, 'access');
        res.status(200).json({
            success: true,
            data: {
                authenticated: true,
                user: {
                    id: req.user.id,
                    email: req.user.email,
                    wallet_address: req.user.wallet_address,
                    is_active: req.user.is_active
                },
                token: {
                    valid: tokenInfo.valid,
                    expiresAt: tokenInfo.expiresAt
                }
            },
            requestId: req.headers['x-request-id']
        });
    }
    catch (error) {
        console.error('Auth status error:', error);
        res.status(500).json({
            error: 'INTERNAL_ERROR',
            message: 'Failed to get auth status',
            requestId: req.headers['x-request-id']
        });
    }
});
exports.default = router;
//# sourceMappingURL=auth.js.map