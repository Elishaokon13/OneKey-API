import { JWTPayload, AuthTokens, User } from '@/types/auth';
export declare class JWTService {
    private readonly accessTokenSecret;
    private readonly refreshTokenSecret;
    private readonly accessTokenExpiry;
    private readonly refreshTokenExpiry;
    constructor();
    /**
     * Generate access and refresh tokens for a user
     */
    generateTokens(user: User): AuthTokens;
    /**
     * Verify and decode an access token
     */
    verifyAccessToken(token: string): JWTPayload;
    /**
     * Verify and decode a refresh token
     */
    verifyRefreshToken(token: string): JWTPayload;
    /**
     * Parse expiry string to seconds
     */
    private parseExpiry;
    /**
     * Refresh access token using a valid refresh token
     */
    refreshAccessToken(refreshToken: string, user: User): AuthTokens;
    /**
     * Revoke a refresh token
     */
    revokeRefreshToken(token: string): void;
    /**
     * Revoke all refresh tokens for a user
     */
    revokeAllUserTokens(userId: string): void;
    /**
     * Generate a secure random nonce for wallet authentication
     */
    generateNonce(): string;
    /**
     * Create a message for wallet signature verification
     */
    createWalletMessage(nonce: string, domain?: string): string;
    /**
     * Verify wallet signature (basic implementation - extend for specific wallets)
     */
    verifyWalletSignature(message: string, signature: string, walletAddress: string): boolean;
    /**
     * Get token expiry information
     */
    getTokenInfo(token: string, type?: 'access' | 'refresh'): {
        valid: boolean;
        expired: boolean;
        payload?: JWTPayload;
        expiresAt?: Date;
    };
    /**
     * Store refresh token metadata
     */
    private storeRefreshToken;
}
export declare const jwtService: JWTService;
//# sourceMappingURL=jwtService.d.ts.map