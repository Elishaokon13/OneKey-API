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
     * Store refresh token metadata
     */
    private storeRefreshToken;
}
export declare const jwtService: JWTService;
//# sourceMappingURL=jwtService.d.ts.map