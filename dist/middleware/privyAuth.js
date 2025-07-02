"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticateHybrid = exports.requireVerifiedEmail = exports.requirePrivyWallet = exports.requirePrivyLinkedUser = exports.optionalPrivyAuth = exports.authenticatePrivy = void 0;
const privyService_1 = require("@/services/auth/privyService");
const authService_1 = require("@/services/auth/authService");
const privy_1 = require("@/types/privy");
/**
 * Privy Authentication middleware
 * Verifies Privy access token and attaches user context to request
 */
const authenticatePrivy = async (req, res, next) => {
    try {
        // Check if Privy is configured
        if (!privyService_1.privyService.isConfigured()) {
            res.status(503).json({
                error: 'PRIVY_NOT_CONFIGURED',
                message: 'Privy authentication service is not configured',
                requestId: req.headers['x-request-id']
            });
            return;
        }
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            res.status(401).json({
                error: 'AUTHENTICATION_REQUIRED',
                message: 'Authorization header is required',
                requestId: req.headers['x-request-id']
            });
            return;
        }
        const token = authHeader.startsWith('Bearer ')
            ? authHeader.slice(7)
            : authHeader;
        if (!token) {
            res.status(401).json({
                error: 'INVALID_TOKEN_FORMAT',
                message: 'Bearer token is required',
                requestId: req.headers['x-request-id']
            });
            return;
        }
        // Verify the Privy access token
        const verification = await privyService_1.privyService.verifyAccessToken(token);
        if (!verification.isValid) {
            if (verification.isExpired) {
                res.status(401).json({
                    error: 'TOKEN_EXPIRED',
                    message: 'Privy access token has expired',
                    requestId: req.headers['x-request-id']
                });
                return;
            }
            res.status(401).json({
                error: 'INVALID_TOKEN',
                message: 'Invalid Privy access token',
                requestId: req.headers['x-request-id']
            });
            return;
        }
        if (!verification.user) {
            res.status(401).json({
                error: 'USER_NOT_FOUND',
                message: 'User not found in Privy',
                requestId: req.headers['x-request-id']
            });
            return;
        }
        // Get our internal user record if it exists
        const internalUser = await findInternalUserFromPrivy(verification.user);
        // Get full Privy context
        const privyContext = await privyService_1.privyService.getAuthContext(token);
        // Attach Privy data to request
        req.privyUser = verification.user;
        req.privyContext = privyContext;
        req.privyToken = token;
        req.user = internalUser; // May be null if user doesn't exist in our system yet
        next();
    }
    catch (error) {
        if (error instanceof privy_1.PrivyVerificationError) {
            res.status(401).json({
                error: 'PRIVY_VERIFICATION_FAILED',
                message: error.message,
                requestId: req.headers['x-request-id']
            });
            return;
        }
        if (error instanceof privy_1.PrivyAuthenticationError) {
            res.status(401).json({
                error: 'PRIVY_AUTH_FAILED',
                message: error.message,
                requestId: req.headers['x-request-id']
            });
            return;
        }
        console.error('Privy authentication error:', error);
        res.status(500).json({
            error: 'AUTHENTICATION_ERROR',
            message: 'Internal Privy authentication error',
            requestId: req.headers['x-request-id']
        });
    }
};
exports.authenticatePrivy = authenticatePrivy;
/**
 * Optional Privy Authentication middleware
 * Attaches Privy context if token is provided, but doesn't require it
 */
const optionalPrivyAuth = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !privyService_1.privyService.isConfigured()) {
        // No token provided or Privy not configured, continue without authentication
        next();
        return;
    }
    try {
        const token = authHeader.startsWith('Bearer ')
            ? authHeader.slice(7)
            : authHeader;
        if (token) {
            const verification = await privyService_1.privyService.verifyAccessToken(token);
            if (verification.isValid && verification.user) {
                const internalUser = await findInternalUserFromPrivy(verification.user);
                const privyContext = await privyService_1.privyService.getAuthContext(token);
                req.privyUser = verification.user;
                req.privyContext = privyContext;
                req.privyToken = token;
                req.user = internalUser;
            }
        }
    }
    catch (error) {
        // Ignore authentication errors for optional auth
        console.warn('Optional Privy auth failed:', error);
    }
    next();
};
exports.optionalPrivyAuth = optionalPrivyAuth;
/**
 * Middleware that requires Privy user to be linked to our internal system
 */
const requirePrivyLinkedUser = (req, res, next) => {
    if (!req.privyUser) {
        res.status(401).json({
            error: 'PRIVY_AUTH_REQUIRED',
            message: 'Privy authentication required',
            requestId: req.headers['x-request-id']
        });
        return;
    }
    if (!req.user) {
        res.status(403).json({
            error: 'USER_NOT_LINKED',
            message: 'Privy user not linked to OneKey account. Please complete registration.',
            requestId: req.headers['x-request-id']
        });
        return;
    }
    next();
};
exports.requirePrivyLinkedUser = requirePrivyLinkedUser;
/**
 * Middleware that requires specific wallet to be linked to Privy user
 */
const requirePrivyWallet = (req, res, next) => {
    if (!req.privyContext) {
        res.status(401).json({
            error: 'PRIVY_AUTH_REQUIRED',
            message: 'Privy authentication required',
            requestId: req.headers['x-request-id']
        });
        return;
    }
    const requiredWallet = req.params.walletAddress || req.body.wallet_address;
    if (!requiredWallet) {
        res.status(400).json({
            error: 'WALLET_ADDRESS_REQUIRED',
            message: 'Wallet address is required',
            requestId: req.headers['x-request-id']
        });
        return;
    }
    const hasWallet = req.privyContext.linkedWallets.some(wallet => wallet.address.toLowerCase() === requiredWallet.toLowerCase());
    if (!hasWallet) {
        res.status(403).json({
            error: 'WALLET_NOT_LINKED',
            message: 'Specified wallet is not linked to your Privy account',
            requestId: req.headers['x-request-id']
        });
        return;
    }
    next();
};
exports.requirePrivyWallet = requirePrivyWallet;
/**
 * Middleware that requires verified email in Privy account
 */
const requireVerifiedEmail = (req, res, next) => {
    if (!req.privyContext) {
        res.status(401).json({
            error: 'PRIVY_AUTH_REQUIRED',
            message: 'Privy authentication required',
            requestId: req.headers['x-request-id']
        });
        return;
    }
    const hasVerifiedEmail = req.privyContext.linkedEmails.some(email => email.verified);
    if (!hasVerifiedEmail) {
        res.status(403).json({
            error: 'EMAIL_VERIFICATION_REQUIRED',
            message: 'Verified email required for this operation',
            requestId: req.headers['x-request-id']
        });
        return;
    }
    next();
};
exports.requireVerifiedEmail = requireVerifiedEmail;
/**
 * Hybrid authentication middleware
 * Accepts both JWT and Privy tokens
 */
const authenticateHybrid = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        res.status(401).json({
            error: 'AUTHENTICATION_REQUIRED',
            message: 'Authorization header is required',
            requestId: req.headers['x-request-id']
        });
        return;
    }
    const token = authHeader.startsWith('Bearer ')
        ? authHeader.slice(7)
        : authHeader;
    if (!token) {
        res.status(401).json({
            error: 'INVALID_TOKEN_FORMAT',
            message: 'Bearer token is required',
            requestId: req.headers['x-request-id']
        });
        return;
    }
    // Try JWT authentication first
    try {
        const { authenticateJWT } = await Promise.resolve().then(() => __importStar(require('./auth')));
        await authenticateJWT(req, res, () => {
            // JWT auth succeeded
            req.headers['auth-type'] = 'jwt';
            next();
        });
        return;
    }
    catch (jwtError) {
        // JWT failed, try Privy if configured
        if (privyService_1.privyService.isConfigured()) {
            try {
                await (0, exports.authenticatePrivy)(req, res, () => {
                    // Privy auth succeeded
                    req.headers['auth-type'] = 'privy';
                    next();
                });
                return;
            }
            catch (privyError) {
                // Both failed
                res.status(401).json({
                    error: 'AUTHENTICATION_FAILED',
                    message: 'Invalid token for both JWT and Privy authentication',
                    requestId: req.headers['x-request-id']
                });
                return;
            }
        }
        else {
            // Only JWT available and it failed
            res.status(401).json({
                error: 'AUTHENTICATION_FAILED',
                message: 'Invalid JWT token',
                requestId: req.headers['x-request-id']
            });
            return;
        }
    }
};
exports.authenticateHybrid = authenticateHybrid;
/**
 * Helper function to find internal user from Privy user data
 */
async function findInternalUserFromPrivy(privyUser) {
    try {
        // Extract email and wallet from Privy user
        const emailAccounts = privyUser.linkedAccounts?.filter((account) => account.type === 'email' && account.email) || [];
        const walletAccounts = privyUser.linkedAccounts?.filter((account) => account.type === 'wallet' && account.address) || [];
        // Try to find user by email first
        for (const emailAccount of emailAccounts) {
            const user = await authService_1.authService.findUserByEmail(emailAccount.email);
            if (user)
                return user;
        }
        // Try to find user by wallet address
        for (const walletAccount of walletAccounts) {
            const user = await authService_1.authService.findUserByWalletAddress(walletAccount.address);
            if (user)
                return user;
        }
        return null;
    }
    catch (error) {
        console.error('Error finding internal user from Privy data:', error);
        return null;
    }
}
//# sourceMappingURL=privyAuth.js.map