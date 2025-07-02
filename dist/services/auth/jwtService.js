"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.jwtService = exports.JWTService = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const environment_1 = __importDefault(require("@/config/environment"));
const auth_1 = require("@/types/auth");
// Refresh token storage (in production, use Redis or database)
const refreshTokens = new Map();
class JWTService {
    accessTokenSecret;
    refreshTokenSecret;
    accessTokenExpiry;
    refreshTokenExpiry;
    constructor() {
        this.accessTokenSecret = environment_1.default.jwt.secret;
        this.refreshTokenSecret = environment_1.default.jwt.refreshSecret;
        this.accessTokenExpiry = environment_1.default.jwt.expiresIn;
        this.refreshTokenExpiry = environment_1.default.jwt.refreshExpiresIn;
        // Validate JWT secrets
        if (!this.accessTokenSecret || this.accessTokenSecret.length < 32) {
            throw new Error('JWT_SECRET must be at least 32 characters long');
        }
        if (!this.refreshTokenSecret || this.refreshTokenSecret.length < 32) {
            throw new Error('JWT_REFRESH_SECRET must be at least 32 characters long');
        }
    }
    /**
     * Generate access and refresh tokens for a user
     */
    generateTokens(user) {
        const now = Math.floor(Date.now() / 1000);
        // Create access token payload
        const accessPayload = {
            user_id: user.id,
            email: user.email,
            wallet_address: user.wallet_address,
            iat: now,
            exp: now + this.parseExpiry(this.accessTokenExpiry),
            type: 'access'
        };
        // Create refresh token payload
        const refreshPayload = {
            user_id: user.id,
            email: user.email,
            wallet_address: user.wallet_address,
            iat: now,
            exp: now + this.parseExpiry(this.refreshTokenExpiry),
            type: 'refresh'
        };
        // Generate tokens
        const accessToken = jsonwebtoken_1.default.sign(accessPayload, this.accessTokenSecret);
        const refreshToken = jsonwebtoken_1.default.sign(refreshPayload, this.refreshTokenSecret);
        // Store refresh token metadata
        this.storeRefreshToken(refreshToken, user.id, refreshPayload.exp);
        return {
            access_token: accessToken,
            refresh_token: refreshToken,
            expires_in: this.parseExpiry(this.accessTokenExpiry),
            token_type: 'Bearer'
        };
    }
    /**
     * Verify and decode an access token
     */
    verifyAccessToken(token) {
        try {
            const decoded = jsonwebtoken_1.default.verify(token, this.accessTokenSecret);
            if (decoded.type !== 'access') {
                throw new auth_1.InvalidTokenError('Invalid token type');
            }
            return decoded;
        }
        catch (error) {
            if (error instanceof jsonwebtoken_1.default.TokenExpiredError) {
                throw new auth_1.TokenExpiredError('Access token has expired');
            }
            if (error instanceof jsonwebtoken_1.default.JsonWebTokenError) {
                throw new auth_1.InvalidTokenError('Invalid access token');
            }
            throw error;
        }
    }
    /**
     * Verify and decode a refresh token
     */
    verifyRefreshToken(token) {
        try {
            const decoded = jsonwebtoken_1.default.verify(token, this.refreshTokenSecret);
            if (decoded.type !== 'refresh') {
                throw new auth_1.InvalidTokenError('Invalid token type');
            }
            // Check if refresh token is revoked
            const tokenData = refreshTokens.get(token);
            if (!tokenData || tokenData.revoked) {
                throw new auth_1.InvalidTokenError('Refresh token has been revoked');
            }
            return decoded;
        }
        catch (error) {
            if (error instanceof jsonwebtoken_1.default.TokenExpiredError) {
                throw new auth_1.TokenExpiredError('Refresh token has expired');
            }
            if (error instanceof jsonwebtoken_1.default.JsonWebTokenError) {
                throw new auth_1.InvalidTokenError('Invalid refresh token');
            }
            throw error;
        }
    }
    /**
     * Parse expiry string to seconds
     */
    parseExpiry(expiry) {
        const unit = expiry.slice(-1);
        const value = parseInt(expiry.slice(0, -1));
        switch (unit) {
            case 's': return value;
            case 'm': return value * 60;
            case 'h': return value * 60 * 60;
            case 'd': return value * 24 * 60 * 60;
            default: return parseInt(expiry); // Assume seconds if no unit
        }
    }
    /**
     * Store refresh token metadata
     */
    storeRefreshToken(token, userId, expiresAt) {
        refreshTokens.set(token, {
            user_id: userId,
            created_at: new Date(),
            expires_at: new Date(expiresAt * 1000),
            revoked: false
        });
    }
}
exports.JWTService = JWTService;
// Export singleton instance
exports.jwtService = new JWTService();
//# sourceMappingURL=jwtService.js.map